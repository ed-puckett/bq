const current_script_url = import.meta.url;  // save for later

// @ts-ignore  // types not available for the imported module
import { version_string } from 'dist/version-info';

import {
    show_initialization_failed,
    save_serializer,
    cell_view_attribute_name,
    cell_view_values_default,
    get_auto_eval,
    set_auto_eval,
    bootstrap_script_src_alternatives_default,
} from 'src/init';

import {
    fs_interface,
} from 'lib/sys/fs-interface';

import {
    SerialDataSource,
    SerialDataSourceSubscription,
} from 'lib/sys/serial-data-source';

import {
    ActivityManager,
    StopState,
} from 'lib/sys/activity-manager';

import {
    CommandContext,
} from 'lib/ui/command-context';

import {
    KeyEventManager,
    KeyMap,
} from 'lib/ui/key/_';

import {
    AlertDialog,
} from 'lib/ui/dialog/_';

import {
    SettingsDialog,
} from './settings-dialog/_';

import {
    open_help_window,
} from './help-window';

import {
    create_element,
    clear_element,
    move_node,
} from 'lib/ui/dom-tools';

import {
    TextBasedRenderer,
    TextBasedRendererOptionsType,
    LocatedError,
    ErrorRenderer,
} from 'src/renderer/_';

import {
    OutputContext,
} from 'src/output-context';

import {
    Menu,
} from 'lib/ui/menu/_';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    NotificationManager,
} from 'lib/ui/notification-manager/_';

import {
    settings_updated_events,
    get_settings,
} from 'src/settings/_';

import {
    get_global_command_bindings,
    get_global_initial_key_map_bindings,
    get_menubar_spec,
    get_ellipsis_menu_spec,
} from './global-bindings';

import {
    ExportOptionsDialog,
} from './export-options-dialog/_';

import {
    beep,
} from 'lib/ui/beep';


// import {
//     assets_server_url,
// } from 'lib/sys/assets-server-url';
// import {
//     create_stylesheet_link,
// } from 'lib/ui/dom-tools';
// {
//     const server_url = assets_server_url(current_script_url);  // current_script_url is from initial import.meta.url
//     create_stylesheet_link(document.head, new URL('./style.css',       server_url));
//     create_stylesheet_link(document.head, new URL('./style-hacks.css', server_url));
// }
import 'src/style.css';        // webpack implementation
import 'src/style-hacks.css';  // webpack implementation


const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;


export class BqManager {
    get CLASS (){ return this.constructor as typeof BqManager; }

    static #singleton: BqManager;

    static get singleton (){
        if (!this.#singleton) {
            this._initialize_singleton();
        }
        return this.#singleton;
    }

    static get ready (){ return !!this.#singleton; }

    // called and awaited in ./init.js as part of initialization process
    static _initialize_singleton(): BqManager {
        if (!this.#singleton) {
            this.#singleton = new this();
        }
        return this.#singleton;
    }

    start() {
        if (!this.CLASS.#singleton) {
            console.warn('BqManager: start() called before BqManager.singleton is initialized');
        } if (this !== this.CLASS.#singleton) {
            console.warn('BqManager: start() called on instance that is not BqManager.singleton');
        } else if (this.#start_called) {
            console.warn('BqManager: start() called more than once');
        } else {
            this.#start_called = true;

            if (get_auto_eval()) {
                this.render_cells();
            } else {
                this.active_cell?.scroll_into_view(true);
            }
        }
    }
    #start_called = false;

    static get version_string (): string { return version_string; }


    constructor() {
        this.#eval_states.subscribe(this.#eval_states_observer.bind(this));  //!!! never unsubscribed

        this.#command_bindings = get_global_command_bindings();

        let initial_key_maps: undefined|Array<KeyMap>;
        try {
            const key_map = new KeyMap(get_global_initial_key_map_bindings());
            initial_key_maps = [ key_map ];
        } catch (error: unknown) {
            console.warn('received error when calling get_global_initial_key_map_bindings()', error);
            initial_key_maps = undefined;
        }
        this.#key_event_manager = new KeyEventManager<BqManager>(this, window, {
            command_observer: this.#perform_command_for_ui.bind(this),
            initial_key_maps,
            // no abort_signal given; never aborted/detached
        });

        try {

            const settings = get_settings();

            // must set bq on all incoming cells
            for (const cell of this.get_cells()) {
                cell._set_bq(this);
            }

            this.reset_global_state();

            // listen for settings changed events and trigger update in cells
            settings_updated_events.subscribe(this.update_from_settings.bind(this));  //!!! never unsubscribed
            this.update_from_settings();  // establish initial settings right away

            this.set_editable(true);

            this.#setup_csp();
            this.#setup_header(!!((settings as any)?.classic_menu));
            this.#set_initial_active_cell();

            // add "changes may not be saved" prompt for when document is being closed while modified
            window.addEventListener('beforeunload', (event: Event): any => {
                if (this.interactive) {
                    const warn = !this.is_neutral();
                    if (warn) {
                        event.preventDefault();
                        event.returnValue = !warn;  // indicate: if false, default action prevented
                        return warn;                // indicate: if true, default action prevented
                    }
                }
            });  //!!! event handler never removed

        } catch (error: unknown) {
            show_initialization_failed(error);
        }
    }

    #activity_manager: ActivityManager = new ActivityManager(true);  // true: multiple_stops
    #eval_states = new SerialDataSource<{ cell: BqCellElement, eval_state: boolean }>();
    #command_bindings: { [command: string]: ((...args: any[]) => any) };
    #key_event_manager: KeyEventManager<BqManager>;
    #with_menubar: undefined|boolean = undefined;  // undefined until first time a menu is set up
    #menu: undefined|Menu<BqManager> = undefined;
    #menu_commands_subscription: undefined|SerialDataSourceSubscription = undefined;
    #menu_selects_subscription:  undefined|SerialDataSourceSubscription = undefined;
    #file_handle: any = null;
    #editable: boolean = true;
    #active_cell: null|BqCellElement = null;
    #global_state: object = {};  // persistent state for renderers
    #cell_ocx_map = new WeakMap<BqCellElement, Set<OutputContext>>();  // maintained by this.invoke_renderer()

    #notification_manager = new NotificationManager();
    get notification_manager (){ return this.#notification_manager; }

    #reset_before_render: boolean = false;  // from settings, kept up-to-date via settings_updated_events
    get reset_before_render (){ return this.#reset_before_render; }

    get head_element (){
        const el = document.querySelector('head');
        if (!el) {
            throw new Error('unexpected: head element not present');
        }
        return el;
    }

    get header_element (){
        const el = document.querySelector('header');
        if (!el) {
            throw new Error('unexpected: header element not present');
        }
        return el;
    }
    get main_element (){
        const el = document.querySelector('main');
        if (!el) {
            throw new Error('unexpected: main element not present');
        }
        return el;
    }

    get_title() {
        const title_element: null|HTMLElement = document.querySelector('head title');
        return title_element ? title_element.innerText : null;
    }
    set_title(title: string) {
        let title_element: null|HTMLElement = this.head_element.querySelector('title');
        if (!title_element) {
            title_element = document.createElement('title');
            this.head_element.appendChild(title_element);
        }
        title_element.innerText = title;
        this.set_structure_modified();
    }

    get cell_view (){ return document.documentElement.getAttribute(cell_view_attribute_name) ?? cell_view_values_default; }

    get in_presentation_view (){ return (this.cell_view === 'presentation'); }

    get interactive (){ return (!this.in_presentation_view || this.active_cell?.shown_in_presentation); }

    get cell_parent (){ return this.main_element; }

    get activity_manager (){ return this.#activity_manager; }

    get editable (){ return this.#editable; }
    set_editable(editable: boolean = true) {
        editable = !!editable;  // ensure Boolean
        this.#editable = editable;
        for (const cell of this.get_cells()) {
            cell.set_editable(editable);
        }
    }

    get active_cell (){ return this.#active_cell; }
    set_active_cell(cell: BqCellElement): void {
        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
        }
        this.#active_cell = cell;
        for (const cell of this.get_cells()) {
            cell.set_active(cell === this.active_cell);
        }
    }

    get global_state (){ return this.#global_state; }
    reset_global_state() {
        this.#global_state = {};
    }
    /** reset the document, meaning that all cells will be reset,
     *  and this.#global_state will be reset.  Also, the saved file
     *  handle this.#file_handle set to undefined.
     *  @return {BqManager} this
     */
    reset() {
        try {
            this.stop();
        } catch (error: unknown) {
            console.error('error calling this.stop()', error, this);
        }
        TextBasedRenderer.reset_renderer_factories();
        this.reset_global_state();
        this.#file_handle = undefined;
        for (const cell of this.get_cells()) {
            try {
                cell.reset();
            } catch (error: unknown) {
                console.error('error calling cell.reset()', error, cell);
            }
        }
        this.set_structure_modified();
        return this;
    }

    /** clear the current document
     * (also removes the title if it exists)
     */
    clear() {
        this.reset();
        if (this.main_element) {
            clear_element(this.main_element);
            const title_element = this.head_element.querySelector('title');
            if (title_element) {
                title_element.remove();
            }
        }
        const first_cell = this.create_cell();
        first_cell.focus();
        this.set_structure_modified();
    }

    stop(): void {
        try {
            this.activity_manager.stop();
        } catch (error) {
            console.error('error while stopping this.activity_manager', error, this.activity_manager);
        }
    }

    stop_cell(cell: BqCellElement): void {
        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
        }
        this.#cell_ocx_map.get(cell)?.forEach(ocx => {
            try {
                ocx.stop();
            } catch (error: unknown) {
                console.error('error while stopping ocx', error, ocx);
            }
        })
    }

    can_stop_cell(cell: BqCellElement): boolean {
        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
            return false;
        } else {
            const ocxs = this.#cell_ocx_map.get(cell);
            if (!ocxs) {
                return false;
            } else {
                return [ ...ocxs.values() ].some(ocx => !ocx.stopped);
            }
        }
    }


    // === KEY MAP STACK ===

    get_key_maps(): Array<KeyMap> {
        return this.#key_event_manager.get_key_maps();
    }
    reset_key_map_stack(): void {
        this.#key_event_manager.reset_key_map_stack();
    }
    push_key_map(key_map: KeyMap): void {
        this.#key_event_manager.push_key_map(key_map);
    }
    pop_key_map(): undefined|KeyMap {
        return this.#key_event_manager.pop_key_map();
    }
    remove_key_map(key_map: KeyMap, remove_subsequent_too: boolean = false): boolean {
        return this.#key_event_manager.remove_key_map(key_map, remove_subsequent_too);
    }


    // === DOCUMENT STRUCTURE ===

    #setup_csp(enabled: boolean = false): void {
        if (enabled) {

            // === CONTENT SECURITY POLICY ===

            // set a Content-Security-Policy that will permit us
            // to dynamically load associated content

            const csp_header_content = [
                //!!! audit this !!!
                "default-src 'self' 'unsafe-eval'",
                "style-src   'self' 'unsafe-inline' *",
                "script-src  'self' 'unsafe-inline' 'unsafe-eval' *",
                "img-src     'self' data: blob: *",
                "media-src   'self' data: blob: *",
                "connect-src data:",
            ].join('; ');

            create_element({
                parent: document.head,
                tag:    'meta',
                attrs: {
                    "http-equiv": "Content-Security-Policy",
                    "content":    csp_header_content,
                },
            });
        }
    }

    #setup_header(with_menubar: boolean): void {
        if (!this.header_element) {
            throw new Error(`bad format for document: header element does not exist`);
        }
        this.set_menu_style(with_menubar);
    }

    #set_initial_active_cell() {
        const active_cell = (
            document.querySelector(`${BqCellElement.custom_element_name}[${BqCellElement.attribute__active}]`) ??  // cell currently set as active
            document.querySelector(`${BqCellElement.custom_element_name}`)                                     ??  // first cell
            this.create_cell()                                                                                     // new cell
        ) as BqCellElement;
        if (active_cell.bq !== this) {
            console.error('unexpected: active_cell has a different bq');
        }
        // this.set_active_cell() will establish the active cell correctly,
        // and reset "active" on all other cells.
        this.set_active_cell(active_cell);
        this.#update_menu_state();
    }


    // === MENU ===

    set_menu_style(with_menubar: boolean) {
        if (with_menubar !== this.#with_menubar) {  // initial undefined value for this.#with_menubar will also trigger
            this.#with_menubar = with_menubar;

            // remove old menu
            this.#menu_commands_subscription?.unsubscribe();
            this.#menu_commands_subscription = undefined;
            this.#menu_selects_subscription?.unsubscribe();
            this.#menu_selects_subscription = undefined;
            this.#menu?.remove();
            this.#menu = undefined;

            // setup new menu
            const get_menu_spec = with_menubar ? get_menubar_spec : get_ellipsis_menu_spec;
            this.#menu = Menu.create<BqManager>(this, this.header_element, get_menu_spec(), {
                as_menubar: with_menubar,
                persistent: true,
                get_command_bindings: get_global_initial_key_map_bindings,
            });
            this.#menu_commands_subscription = this.#menu.commands.subscribe(this.#perform_command_for_ui.bind(this));
            this.#menu_selects_subscription = this.#menu.selects.subscribe(this.#update_menu_state.bind(this));
        }
    }


    // === NEUTRAL STATE ===

    is_neutral() {
        return !this.#structure_modified && this.get_cells().every(cell => cell.is_neutral());
    }

    // this.set_neutral() also sets this.#structure_modified = false;
    set_neutral() {
        for (const cell of this.get_cells()) {
            cell.set_neutral();
        }
        this.#structure_modified = false;
    }

    set_structure_modified() {
        this.#structure_modified = true;
    }
    #structure_modified: boolean = false;


    // === SAVE HANDLING ====

    async perform_save(perform_save_as: boolean = false, show_options_dialog: boolean = false): Promise<boolean> {
        if (show_options_dialog) {
            perform_save_as = true;  // show_options_dialog implies perform_save_as
        }
        if (!perform_save_as && !show_options_dialog) {
            if (this.is_neutral()) {
                // no need to actually save
                this.notification_manager.add('no changes need to be saved');
                return true;  // indicate: not canceled
            }
        }

        let bootstrap_script_src = bootstrap_script_src_alternatives_default;
        let cell_view            = undefined;
        let auto_eval            = get_auto_eval();
        let active_cell          = false;
        if (show_options_dialog) {
            const options_dialog_result = await ExportOptionsDialog.run();
            if (!options_dialog_result) {
                this.notification_manager.add('save canceled');
                return false;  // indicate: canceled
            }
            ( {
                bootstrap_script_src,
                cell_view,
                auto_eval   = false,
                active_cell = false,
            } = Object.fromEntries([ ...options_dialog_result ]) as any );
            if (!cell_view) {
                cell_view = undefined;  // "unset"
            }
        }

        const bound_serializer = save_serializer.bind(null, bootstrap_script_src, {
            cell_view,
            auto_eval,
            active_cell,
        });
        const save_result = await fs_interface.save(bound_serializer, {
            file_handle: perform_save_as ? undefined : this.#file_handle,
            prompt_options: {
                suggestedName: this.#get_suggested_filename(),//!!!
            },
        });
        const {
            canceled,
            file_handle,
            stats,
        } = (save_result as any);
        if (canceled) {
            this.notification_manager.add('save canceled');
        } else {
            this.#file_handle = file_handle ?? undefined;
            this.set_neutral();
            this.notification_manager.add('document saved');
        }
        return !canceled;
    }

    #get_suggested_filename(): string {
        return window.location.pathname.split('/').slice(-1)[0];
    }


    // === RENDER INTERFACE ===

    async invoke_renderer_for_type( type:            string = 'plain',
                                    options?:        null|TextBasedRendererOptionsType,
                                    cell?:           null|BqCellElement,
                                    output_element?: Element ): Promise<Element> {
        if (cell && cell.bq !== this) {
            throw new TypeError('unexpected: cell has a different bq');
        }
        type ??= 'plain';
        const renderer = TextBasedRenderer.renderer_for_type(type);
        if (!renderer) {
            throw new TypeError('no renderer found for type "${type}"');
        }
        return this.invoke_renderer(renderer, options, cell, output_element);
    }

    async invoke_renderer( renderer:        TextBasedRenderer,
                           options?:        null|TextBasedRendererOptionsType,
                           cell?:           null|BqCellElement,
                           output_element?: Element ): Promise<Element> {
        if (!(renderer instanceof TextBasedRenderer)) {
            throw new TypeError('renderer must be an instance of TextBasedRenderer');
        }
        if (typeof options !== 'undefined' && options !== null && typeof options !== 'object') {
            throw new TypeError('options must be undefined, null, or an object');
        }
        cell ??= this.active_cell;
        if (!cell) {
            throw new TypeError('cell not specified and no active_cell');
        }
        if (cell.bq !== this) {
            throw new TypeError('unexpected: cell has a different bq');
        }
        if (typeof output_element !== 'undefined' && !(output_element instanceof Element)) {
            throw new TypeError('output_element must be undefined or an instance of Element');
        }

        cell.ensure_id();
        const cell_id = cell.id;

        if (!options?.global_state) {
            options = {
                ...(options ?? {}),
                global_state: this.global_state,
            };
        }

        // reset_before_render is performed only if no output_element was passed in
        if (!output_element && this.#reset_before_render) {
            cell.reset();
        }

        output_element ??= OutputContext.create_cell_output(cell, renderer.media_type);

        // The following event listeners are not normally explicitly removed.
        // Instead, if the element is removed, we rely on the event listener
        // resources to be cleaned up, too.
        const event_listener = (event: Event) => {
            // use querySelector() to re-find the cell in case it is no longer present
            const refound_cell = document.querySelector(`#${cell_id}`);
            if (refound_cell instanceof BqCellElement) {
                if (refound_cell !== this.active_cell && refound_cell.bq === this) {
                    this.set_active_cell(refound_cell);
                }
            }
        };
        output_element.addEventListener('focus', event_listener, { capture: true });
        output_element.addEventListener('click', event_listener, { capture: true });

        const ocx = new OutputContext(this, output_element);  // multiple_stops = false
        this.#associate_cell_ocx(cell, ocx);
        this.activity_manager.manage_activity(ocx, () => {
            this.#dissociate_cell_ocx(cell, ocx);
        });

        return renderer.render(ocx, cell.get_text(), options)
            .catch((error) => {
                const error_message_element = ErrorRenderer.render_sync(ocx, error, { abbreviated: true });
                error_message_element.scrollIntoView(false);
                if (error instanceof LocatedError) {
                    cell?.set_cursor_position(error.line_number, error.column_index);
                }
                if (!ocx.keepalive) {
                    ocx.stop();  // stop anything that may have been started
                }
                throw error;
            })
            .finally(() => {
                if (!ocx.keepalive) {
                    ocx.stop();  // stop anything that may have been started
                }
            });
    }

    /** this.#rendering_cells is set to a promise when render_cells() is active,
     * and removed and set back to undefined when render_cells() is done.
     * (render_cells() implements the command "eval-all".)
     * If render_cells() completes without error, then the promise will be
     * fulfilled after queueing a microtask.  Otherwise if there was an error,
     * the promise never settles.
     */
    #rendering_cells: undefined|Promise<any> = undefined;
    get rendering_cells (){ return this.#rendering_cells; }

    async render_cells(limit_cell?: null|BqCellElement): Promise<boolean> {
        let result = false;

        var resolve_rendering_cells: undefined|((value: PromiseLike<any> | any) => void);
        this.#rendering_cells = new Promise((resolve) => {
            resolve_rendering_cells = resolve;
        });

        const cells = this.get_cells();
        if (!limit_cell || cells.indexOf(limit_cell) !== -1) {
            this.set_structure_modified();
            this.stop();  // stop any previously-running renderers
            this.reset_global_state();

            let stopped = false;
            const stop_states_subscription = this.activity_manager.stop_states.subscribe((state: StopState) => {
                stopped = true;
            })

            let render_error: unknown = undefined;

            cell_eval_loop:
            for (const iter_cell of cells) {
                if (stopped) {
                    this.notification_manager.add('stopped');
                    break;
                }
                iter_cell.scroll_into_view(true);
                if (limit_cell && iter_cell === limit_cell) {
                    break;  // only eval cells before limit_cell if limit_cell given
                }

                try {
                    await this.invoke_renderer_for_type(iter_cell.type, undefined, iter_cell);
                } catch (error: unknown) {
                    console.warn('stopped render_cells after error rendering cell', error, iter_cell);
                    render_error = error;
                    break cell_eval_loop;
                }
            }

            result = !render_error;

            stop_states_subscription.unsubscribe();

            this.#rendering_cells = undefined;
            // Only resolve the promise if there were no errors.
            // The reason is that if there was an error (for example, the ocx
            // threw an error after being stopped), then the ocx will be
            // unusable and trying to do something with it will just cause
            // more errors....
            if (!render_error) {
                // use setTimeout to allow async operations to settle before
                // calling resolve_rendering_cells().
                setTimeout(() => {
                    try {
                        // typescript cannot determine that resolve_rendering_cells
                        // is not undefined...
                        resolve_rendering_cells?.(undefined);
                    } catch (error) {
                        console.warn('error received while calling resolve_rendering_cells()', error);
                    }
                });
            }
        }

        return result;
    }

    #associate_cell_ocx(cell: BqCellElement, ocx: OutputContext) {
        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
        }
        if (ocx.bq !== this) {
            console.error('unexpected: ocx has a different bq');
        }
        const ocx_set = this.#cell_ocx_map.get(cell);
        if (ocx_set) {
            ocx_set.add(ocx);
        } else {
            const new_ocx_set = new Set<OutputContext>();
            new_ocx_set.add(ocx);
            this.#cell_ocx_map.set(cell, new_ocx_set);
        }
    }

    #dissociate_cell_ocx(cell: BqCellElement, ocx: OutputContext) {
        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
        }
        if (ocx.bq !== this) {
            console.error('unexpected: ocx has a different bq');
        }
        const ocx_set = this.#cell_ocx_map.get(cell);
        if (ocx_set) {
            ocx_set.delete(ocx);
            if (ocx_set.size <= 0) {
                this.#cell_ocx_map.delete(cell);
            }
        }
    }

    // === COMMAND HANDLER INTERFACE ===

    /** Inject a KeyboardEvent but with target updated to be within this.active_cell.
     * @param {KeyboardEvent} key_event
     */
    inject_key_event(key_event: KeyboardEvent): void {
        const active_cell = this.active_cell;
        const target      = key_event.target;
        if (active_cell && target instanceof Node && !active_cell.contains(target)) {
            key_event = this.#key_event_manager.CLASS.clone_key_event_with_alternate_target(key_event, active_cell);
        }
        this.#key_event_manager.inject_key_event(key_event);
    }

    /** Inject a synthetic command.
     * @param {string} command to be performed.
     * This command is performed within a command_context where dm (the
     * DocumentManager) is set to this BqManager instance and target is
     * set to this.active_cell.
     */
    async inject_command(command: string) {
        return this.#perform_command({ dm: this, command });
    }

    /** Perform the command representing by command_context.
     * @param {CommandContext} command_context
     * @return {Promise<boolean>} a promise that resolves to a boolean
     *                            indicating success.
     * An updated command_context with target set to this.active_cell is sent
     * to the command handler.  Note that commands that operate asynchronously
     * begin their actions synchronously but do not complete immediately.
     * This is relevant when implementing ui operations; see
     * #perform_command_for_ui().
     */
    async #perform_command(command_context: CommandContext<BqManager>): Promise<boolean> {
        if (typeof command_context !== 'object') {
            throw new TypeError('command_context must be an object');
        }
        if (command_context.dm !== this) {
            throw new TypeError('command_context.dm does not match this BqManager instance');
        }
        if (typeof command_context.command !== 'string' || command_context.command.length <= 0) {
            throw new TypeError('command_context.command must be a non-empty string');
        }
        let result: boolean = false;  // for now...
        try {
            if (command_context) {
                const updated_command_context = {
                    ...command_context,
                    dm:     this,
                    target: this.active_cell,
                };
                const bindings_fn = this.#command_bindings[updated_command_context.command];
                if (bindings_fn) {
                    if (bindings_fn instanceof AsyncFunction) {
                        return bindings_fn(updated_command_context)
                            .catch((error: unknown) => {
                                console.error('error performing command', updated_command_context, error);
                                return false;
                            });
                    } else {
                        result = bindings_fn(updated_command_context);
                    }
                }
            }
        } catch (error: unknown) {
            console.error('error performing command', command_context, error);
        }
        return result;
    }

    async #perform_command_for_ui(command_context: CommandContext<BqManager>): Promise<void> {
        const result = await this.#perform_command(command_context);
        if (!result) {
            beep();
        }
    }

    #update_menu_state() {
        //!!! review this !!!
        const menu = this.#menu;
        if (menu) {
            const presentation    = this.in_presentation_view;
            const interactive     = this.interactive;
            const all_cells       = this.get_cells();
            const cells           = all_cells.filter(cell => cell.showing);
            const active_cell     = this.active_cell;
            const active_index    = active_cell ? cells.indexOf(active_cell) : -1;
            const editable        = this.editable;
            const cell_type       = active_cell?.type;
            const cell_view       = this.cell_view;
            const has_save_handle = !!this.#file_handle;
            const is_neutral      = this.is_neutral();

            menu.set_menu_state('clear-all',                   { enabled: !presentation && editable });

            menu.set_menu_state('save',                        { enabled: !is_neutral && has_save_handle });
            // no update to command 'save-as'
            // no update to command 'export'

            menu.set_menu_state('toggle-auto-eval',            { checked: get_auto_eval(), enabled: !presentation });

            // no update to command 'settings'

            menu.set_menu_state('eval',                        { enabled: interactive && editable && !!active_cell });
            menu.set_menu_state('eval-and-refocus',            { enabled: interactive && editable && !!active_cell });
            menu.set_menu_state('eval-before',                 { enabled: interactive && editable && !!active_cell });
            menu.set_menu_state('eval-all',                    { enabled: interactive && editable && !!active_cell });

            menu.set_menu_state('stop',                        { enabled: active_cell?.can_stop });
            menu.set_menu_state('stop-all',                    { enabled: all_cells.some(cell => cell.can_stop) });

            menu.set_menu_state('reset',                       { enabled: interactive   && editable });
            menu.set_menu_state('reset-all',                   { enabled: !presentation && editable });

            menu.set_menu_state('focus-up',                    { enabled: interactive && !!active_cell && active_index > 0 });
            menu.set_menu_state('focus-down',                  { enabled: interactive && !!active_cell && active_index < cells.length-1 });

            menu.set_menu_state('move-up',                     { enabled: !presentation && !!active_cell && active_index > 0 });
            menu.set_menu_state('move-down',                   { enabled: !presentation && !!active_cell && active_index < cells.length-1 });
            menu.set_menu_state('add-before',                  { enabled: !presentation && editable && !!active_cell });
            menu.set_menu_state('add-after',                   { enabled: !presentation && editable && !!active_cell });
            menu.set_menu_state('duplicate',                   { enabled: !presentation && editable && !!active_cell });
            menu.set_menu_state('delete',                      { enabled: !presentation && editable && !!active_cell });

            menu.set_menu_state('toggle-show-full',            { checked: !!active_cell?.shown_full,            enabled: interactive });
            menu.set_menu_state('toggle-show-in-presentation', { checked: !!active_cell?.shown_in_presentation, enabled: interactive });

            menu.set_menu_state('set-type-plain',              { checked: (cell_type === 'plain'),      enabled: interactive });
            menu.set_menu_state('set-type-markdown',           { checked: (cell_type === 'markdown'),   enabled: interactive });
            menu.set_menu_state('set-type-latex',              { checked: (cell_type === 'latex'),      enabled: interactive });
            menu.set_menu_state('set-type-javascript',         { checked: (cell_type === 'javascript'), enabled: interactive });

            menu.set_menu_state('set-view-normal',             { checked: (cell_view === 'normal') });
            menu.set_menu_state('set-view-hide',               { checked: (cell_view === 'hide') });
            menu.set_menu_state('set-view-full',               { checked: (cell_view === 'full') });
            menu.set_menu_state('set-view-none',               { checked: (cell_view === 'none') });
            menu.set_menu_state('set-view-presentation',       { checked: (cell_view === 'presentation') });

            // no update to command 'help'
        }
    }

    update_from_settings() {
        const {
            classic_menu,
            editor_options,
            render_options,
        } = (get_settings() ?? {}) as any;
        this.set_menu_style(classic_menu);
        for (const cell of this.get_cells()) {
            cell.update_from_settings();
        }
        // update --cell-max-height-scrolling
        const root_element = document.querySelector(':root') as HTMLElement
        if (root_element) {
            (root_element as HTMLElement).style.setProperty('--cell-max-height-scrolling', `${editor_options?.limited_size ?? 50}vh`);
        }
        // update reset_before_render
        this.#reset_before_render = !!render_options?.reset_before_render;
    }


    // === EVAL STATES ===

    emit_eval_state(cell: BqCellElement, eval_state: boolean) {
        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
        }
        this.#eval_states.dispatch({ cell, eval_state });
    }

    #eval_states_observer(data: { cell: BqCellElement, eval_state: boolean }) {
        const {
            cell,
            eval_state,
        } = data;

        if (cell.bq !== this) {
            console.error('unexpected: cell has a different bq');
        }

        //!!! do something...  is this observer necessary?
    }


    // === CELL MANAGEMENT ===

    /** return an ordered list of the BqCellElement (bq-cell) cells in the document
     */
    get_cells(): BqCellElement[] {
        return [ ...document.getElementsByTagName(BqCellElement.custom_element_name) ] as BqCellElement[];
    }

    /** Return the cell that is adjacent to the given cell, either forward (or
     * alternately backward) from the reference.  If include_non_shown is false,
     * then only currently shown cells are considered.
     * @param {undefined|BqCellElement} reference (default: this.active_cell)
     * @param {Boolean} forward
     * @param {Boolean} include_non_shown
     * @return {undefined|BqCellElement} the adjacent cell, or undefined if
     *     reference does not exist in the document or if there is
     *     no such adjacent cell.
     */
    adjacent_cell(reference?: BqCellElement, forward: boolean = false, include_non_shown: boolean = false): undefined|BqCellElement {
        if (reference && reference.bq !== this) {
            throw new TypeError('unexpected: reference cell has a different bq');
        } else {
            const cells = include_non_shown
                ? this.get_cells()
                : this.get_cells().filter(cell => cell.showing);
            const pos = reference ? cells.indexOf(reference) : -1;
            if (pos === -1) {
                return undefined;
            } else {
                if (forward) {
                    if (pos === cells.length-1) {
                        return undefined;
                    } else {
                        return cells[pos+1];
                    }
                } else {
                    if (pos === 0) {
                        return undefined;
                    } else {
                        return cells[pos-1];
                    }
                }
            }
        }
    }

    /** create a new cell in the document
     *  @param (Object|null|undefined} options
     *  @return {BqCellElement} new cell
     * options is passed to create_element() but with "parent" and "before"
     * set if not already set.
     */
    create_cell(options?: object): BqCellElement {
        const extended_options = (options && ('parent' in (options as any) || 'before' in (options as any)))
            ? options
            : {
                parent: this.main_element,
                ...options,
            };
        const cell = create_element({
            tag: BqCellElement.custom_element_name,
            set_id: true,
            ...extended_options,
        }) as BqCellElement;
        cell._set_bq(this);
        cell.set_editable(true);
        return cell;
    }


    // === SHOW UNHANDLED EVENT ===

    _show_unhandled_event(event: Event, is_unhandled_rejection: boolean): void {
        const message = `Unhandled ${is_unhandled_rejection ? 'rejection' : 'error'}: ${(event as any)?.reason?.message}`;
        AlertDialog.run(message);
    }


    // === COMMAND HANDLER IMPLEMENTATIONS ===

    // These command__* methods handle commands directly without user interaction.
    //
    // Each of these command__* methods each returns a boolean.  The return value
    // is true iff the command was successfully handled.
    //
    // command_context.target is used for the target cell, ignoring this.active_cell.
    //
    // These commands are non-interactive, however the following commands by necessity
    // interact with the user to some degree:
    //
    // - command__save,
    // - command__save_as,
    // - command__export ................. must use the system file select dialog due to sandbox
    //                                     also, shows notification
    //
    // - command__toggle_auto_eval ....... shows notification
    //
    // - command__show_settings_dialog ... shows settings dialog
    //
    // - command__eval_before,
    // - command__eval_all ............... will show notification if evaluation is subsequently stopped
    //
    // - command__focus_up,
    // - command__focus_down,
    // - command__move_up,
    // - command__move_down,
    // - command__add_before,
    // - command__add_after,
    // - command__duplicate,
    // - command__delete ................. scrolls cell into view
    //
    // - command__show_help .............. opens help window

    async command__clear_all(command_context: CommandContext<BqManager>): Promise<boolean> {
        this.clear();
        return true;
    }

    async command__save(command_context: CommandContext<BqManager>): Promise<boolean> {
        return this.perform_save();
    }

    async command__save_as(command_context: CommandContext<BqManager>): Promise<boolean> {
        return this.perform_save(true);
    }

    async command__export(command_context: CommandContext<BqManager>): Promise<boolean> {
        return this.perform_save(true, true);
    }

    command__toggle_auto_eval(command_context: CommandContext<BqManager>): boolean {
        const new_auto_eval_setting = !get_auto_eval();
        set_auto_eval(new_auto_eval_setting);
        this.set_structure_modified();
        this.notification_manager.add(`auto-eval ${new_auto_eval_setting ? 'on' : 'off'}`);
        return true;
    }

    command__show_settings_dialog(command_context: CommandContext<BqManager>): boolean {
        SettingsDialog.run();
        return true;
    }

    /** eval target cell
     *  @return {Boolean} true iff command successfully handled
     */
    async command__eval(command_context: CommandContext<BqManager>): Promise<boolean> {
        const cell = command_context.target;
        if (!(cell instanceof BqCellElement)) {
            return false;
        } else {
            this.set_structure_modified();
            try {
                await this.invoke_renderer_for_type(cell.type, undefined, cell);
            } catch (error: unknown) {
                console.warn('error rendering cell', error, cell);
                return false;
            }
            return true;
        }
    }

    async #multi_eval_helper(command_context: CommandContext<BqManager>, eval_all: boolean = false): Promise<boolean> {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            return eval_all
                ? this.render_cells()
                : this.render_cells(command_context.target);
        }
    }

    /** reset global eval context and then eval all cells in the document
     *  from the beginning up to but not including the target cell.
     *  @return {Boolean} true iff command successfully handled
     */
    async command__eval_before(command_context: CommandContext<BqManager>): Promise<boolean> {
        return this.#multi_eval_helper(command_context, false);
    }

    /** stop all running evaluations, reset global eval context and then eval all cells in the document
     *  from first to last, and set focus to the last.
     *  @return {Boolean} true iff command successfully handled
     */
    async command__eval_all(command_context: CommandContext<BqManager>): Promise<boolean> {
        return this.#multi_eval_helper(command_context, true);
    }

    /** stop evaluation for the target cell.
     *  @return {Boolean} true iff command successfully handled
     */
    command__stop(command_context: CommandContext<BqManager>): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            command_context.target.stop();
            return true;
        }
    }

    /** stop all running evaluations.
     *  @return {Boolean} true iff command successfully handled
     */
    command__stop_all(command_context: CommandContext<BqManager>): boolean {
        this.stop();
        return true;
    }

    command__reset(command_context: CommandContext<BqManager>): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            command_context.target.reset();
            this.set_structure_modified();
            return true;
        }
    }

    command__reset_all(command_context: CommandContext<BqManager>): boolean {
        this.reset();
        return true;
    }

    command__focus_up(command_context: CommandContext<BqManager>): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            const focus_cell = this.adjacent_cell(command_context.target, false);
            if (!focus_cell) {
                return false;
            } else {
                focus_cell.scroll_into_view(true);
                return true;
            }
        }
    }

    command__focus_down(command_context: CommandContext<BqManager>): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            const focus_cell = this.adjacent_cell(command_context.target, true);
            if (!focus_cell) {
                return false;
            } else {
                focus_cell.scroll_into_view(true);
                return true;
            }
        }
    }

    #move_helper(command_context: CommandContext<BqManager>, move_down: boolean): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            const cell = command_context.target;
            let before = this.adjacent_cell(cell, move_down);
            if (!before) {
                return false;
            } else {
                if (move_down) {
                    before = this.adjacent_cell(before, move_down);
                }
                const parent = before ? before.parentElement : this.cell_parent;
                move_node(cell, { parent, before });
                // now move associated output elements, if any
                // note that we support multiple output elements per cell, even
                // though there is usually only one.
                const output_elements = [ ...document.querySelectorAll(cell.get_output_element_selector()) ];
                for (const oe of output_elements.toReversed()) {  // reverse because assuming output elements follow cell
                    const oe_next_sibling = oe.nextSibling;
                    // move newline text node, if any, following output element, too.
                    // it is included for formatting....
                    if (oe_next_sibling && oe_next_sibling.nodeType === Node.TEXT_NODE && oe_next_sibling.nodeValue === '\n') {
                        move_node(oe_next_sibling, {
                            parent,
                            before: cell.nextElementSibling,
                        });
                    }
                    // now move the output element
                    // note that we are moving these nodes in reverse order
                    // because they are being moved releative to cell.nextElementSibling
                    move_node(oe, {
                        parent,
                        before: cell.nextSibling,
                    });
                }
                cell.scroll_into_view(true);
                this.set_structure_modified();
                return true;
            }
        }
    }

    command__move_up(command_context: CommandContext<BqManager>): boolean {
        return this.#move_helper(command_context, false);
    }

    command__move_down(command_context: CommandContext<BqManager>): boolean {
        return this.#move_helper(command_context, true);
    }

    #add_cell_helper(command_context: CommandContext<BqManager>, add_before: boolean, duplicate: boolean = false) {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            const current_cell = command_context.target;
            this.set_structure_modified();
            const this_cell = command_context.target;
            const before = add_before
                ? this_cell
                : this.adjacent_cell(this_cell, true);
            const parent = before ? before.parentElement : this.cell_parent;
            const new_cell = this.create_cell({ before, parent });
            if (!new_cell) {
                return false;
            } else {
                new_cell.type = current_cell.type;
                if (duplicate) {
                    new_cell.set_text(current_cell.get_text());
                }
                new_cell.scroll_into_view(true);
                return true;
            }
        }
    }

    command__add_before(command_context: CommandContext<BqManager>): boolean {
        return this.#add_cell_helper(command_context, true);
    }

    command__add_after(command_context: CommandContext<BqManager>): boolean {
        return this.#add_cell_helper(command_context, false);
    }

    command__duplicate(command_context: CommandContext<BqManager>): boolean {
        return this.#add_cell_helper(command_context, false, true);
    }

    async command__delete(command_context: CommandContext<BqManager>): Promise<boolean> {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            this.set_structure_modified();
            const cell = command_context.target;
            let next_cell = this.adjacent_cell(cell, true) ?? this.adjacent_cell(cell, false);
            cell.reset();  // stop cell and remove output element, if any
            cell.remove();
            if (!next_cell) {
                next_cell = this.create_cell();
            }
            next_cell.scroll_into_view(true);
            return true;
        }
    }

    command__toggle_show_full(command_context: CommandContext<BqManager>): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            command_context.target.show_full(!command_context.target.shown_full);
            this.set_structure_modified();
            return true;
        }
    }

    command__toggle_show_in_presentation(command_context: CommandContext<BqManager>): boolean {
        if (!(command_context.target instanceof BqCellElement)) {
            return false;
        } else {
            command_context.target.show_in_presentation(!command_context.target.shown_in_presentation);
            this.set_structure_modified();
            return true;
        }
    }

    #set_type_helper(command_context: CommandContext<BqManager>, type: string) {
        this.set_structure_modified();
        const cell = command_context.target;
        if (!(cell instanceof BqCellElement)) {
            return false;
        } else {
            cell.type = type;
            return true;
        }
    }

    /** set the target cell's type to "markdown".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_type_markdown(command_context: CommandContext<BqManager>): boolean {
        return this.#set_type_helper(command_context, 'markdown');
    }

    /** set the target cell's type to "latex".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_type_latex(command_context: CommandContext<BqManager>): boolean {
        return this.#set_type_helper(command_context, 'latex');
    }

    /** set the target cell's type to "javascript".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_type_javascript(command_context: CommandContext<BqManager>): boolean {
        return this.#set_type_helper(command_context, 'javascript');
    }

    /** set the target cell's type to "plain".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_type_plain(command_context: CommandContext<BqManager>): boolean {
        return this.#set_type_helper(command_context, 'plain');
    }

    #set_view_helper(command_context: CommandContext<BqManager>, view: string): boolean {
        this.set_structure_modified();
        if (view === cell_view_values_default) {
            document.documentElement.removeAttribute(cell_view_attribute_name);
        } else {
            document.documentElement.setAttribute(cell_view_attribute_name, view);
        }
        return true;
    }

    /** set the document view to "normal".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_view_normal(command_context: CommandContext<BqManager>): boolean {
        return this.#set_view_helper(command_context, 'normal');
    }

    /** set the document view to "hide".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_view_hide(command_context: CommandContext<BqManager>): boolean {
        return this.#set_view_helper(command_context, 'hide');
    }

    /** set the document view to "full".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_view_full(command_context: CommandContext<BqManager>): boolean {
        return this.#set_view_helper(command_context, 'full');
    }

    /** set the document view to "none".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_view_none(command_context: CommandContext<BqManager>): boolean {
        return this.#set_view_helper(command_context, 'none');
    }

    /** set the document view to "presentation".
     *  @return {Boolean} true iff command successfully handled
     */
    command__set_view_presentation(command_context: CommandContext<BqManager>): boolean {
        return this.#set_view_helper(command_context, 'presentation');
    }

    command__show_help(command_context: CommandContext<BqManager>): boolean {
        open_help_window();
        return true;
    }
}
(globalThis as any).BqManager = BqManager;//!!!
