const current_script_url = import.meta.url;  // save for later

import {
    show_initialization_failed,
    save_serializer,
    cell_view_attribute_name,
    cell_view_values_default,
    get_auto_eval,
    bootstrap_script_src_alternatives_default,
} from 'src/init';

import {
    fs_interface,
} from 'lib/sys/fs-interface';

import {
    SerialDataSource,
    Subscription,
} from 'lib/sys/serial-data-source';

import {
    ActivityManager,
    StopState,
} from 'lib/sys/activity-manager';

import {
    KeyEventManager,
    KeyMap,
    CommandContext,
} from 'lib/ui/key/_';

import {
    AlertDialog,
} from 'lib/ui/dialog/_';

import {
    create_element,
    clear_element,
} from 'lib/ui/dom-tools';

import {
    TextBasedRenderer,
    TextBasedRendererOptionsType,
} from 'src/renderer/_';

import {
    OutputContext,
} from 'src/output-context/_';

import {
    Menu,
} from 'lib/ui/menu/_';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    EventListenerManager,
} from 'lib/sys/event-listener-manager';

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

    constructor() {
        this.#eval_states.subscribe(this.#eval_states_observer.bind(this));  //!!! never unsubscribed

        this.#command_bindings = get_global_command_bindings();

        this.#key_event_manager = new KeyEventManager<BqManager>(this, window, this.#perform_command.bind(this));

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

            const key_map = new KeyMap(get_global_initial_key_map_bindings());
            this.push_key_map(key_map);
            this.#key_event_manager.attach();

            this.set_editable(true);

            this.#setup_csp();
            this.#setup_header(!!(settings as any)?.classic_menu);
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

        } catch (error) {
            show_initialization_failed(error);
        }
    }

    #activity_manager: ActivityManager = new ActivityManager(true);  // true: multiple_stops
    #eval_states = new SerialDataSource<{ cell: BqCellElement, eval_state: boolean }>();
    #command_bindings: { [command: string]: ((...args: any[]) => any) };
    #key_event_manager: KeyEventManager<BqManager>;
    #with_menubar: undefined|boolean = undefined;  // undefined until first time a menu is set up
    #menu: undefined|Menu<BqManager> = undefined;
    #menu_commands_subscription: undefined|Subscription = undefined;
    #menu_selects_subscription:  undefined|Subscription = undefined;
    #file_handle: any = null;
    #editable: boolean = true;
    #active_cell: null|BqCellElement = null;
    #global_state: object = {};  // persistent state for renderers
    #cell_ocx_map = new WeakMap<BqCellElement, Set<OutputContext>>();  // maintained by this.invoke_renderer()

    #notification_manager = new NotificationManager();
    get notification_manager (){ return this.#notification_manager; }

    #reset_before_render: boolean = false;  // from settings, kept up-to-date via settings_updated_events
    get reset_before_render (){ return this.#reset_before_render; }

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
     */
    clear() {
        this.reset();
        if (this.main_element) {
            clear_element(this.main_element);
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
            this.#menu_commands_subscription = this.#menu.commands.subscribe(this.#perform_command.bind(this));
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
                                    output_element?: Element ): Promise<{ element: Element, remove_event_handlers: () => void }> {
        if (cell && cell.bq !== this) {
            throw new Error('unexpected: cell has a different bq');
        }
        type ??= 'plain';
        const renderer = TextBasedRenderer.renderer_for_type(type);
        if (!renderer) {
            throw new Error('no renderer found for type "${type}"');
        }
        return this.invoke_renderer(renderer, options, cell, output_element);
    }

    async invoke_renderer( renderer:        TextBasedRenderer,
                           options?:        null|TextBasedRendererOptionsType,
                           cell?:           null|BqCellElement,
                           output_element?: Element ): Promise<{ element: Element, remove_event_handlers: () => void }> {
        cell ??= this.active_cell;
        if (!cell) {
            throw new Error('cell not specified and no active_cell');
        }
        if (cell.bq !== this) {
            throw new Error('unexpected: cell has a different bq');
        }

        cell.ensure_id();
        const cell_id = cell.id;

        options ??= {};
        if (!options.global_state) {
            options = {
                ...options,
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
        // resources to be cleaned up, too.  However, the returned function
        // remove_event_handlers() can be called to explicitly remove the
        // handlers.  This is useful if the output_element is passed in
        // from the outside and that sort of control is desired.
        const event_listener_manager = new EventListenerManager();
        const event_listener = (event: Event) => {
            // use querySelector() to re-find the cell in case it is no longer present
            const refound_cell = document.querySelector(`#${cell_id}`);
            if (refound_cell instanceof BqCellElement) {
                if (refound_cell !== this.active_cell && refound_cell.bq === this) {
                    this.set_active_cell(refound_cell);
                }
            }
        };
        event_listener_manager.add(output_element, 'focus', event_listener, { capture: true });
        event_listener_manager.add(output_element, 'click', event_listener, { capture: true });
        event_listener_manager.attach();
        const remove_event_handlers = () => {
            if (event_listener_manager.attached) {
                event_listener_manager.detach();
            }
        };

        const ocx = new OutputContext(this, output_element);  // multiple_stops = false
        this.#associate_cell_ocx(cell, ocx);
        this.activity_manager.manage_activity(ocx, () => {
            this.#dissociate_cell_ocx(cell, ocx);
        });

        return renderer.render(ocx, cell.get_text(), options)
            .then((element) => ({ element, remove_event_handlers }))
            .finally(() => {
                if (!ocx.keepalive) {
                    ocx.stop();  // stop anything that may have been started
                }
            });
    }

    async render_cells(limit_cell?: null|BqCellElement): Promise<boolean> {
        const cells = this.get_cells();
        if (limit_cell && cells.indexOf(limit_cell) === -1) {
            return false;
        } else {
            this.set_structure_modified();
            this.stop();  // stop any previously-running renderers
            this.reset_global_state();

            let stopped = false;
            const stop_states_subscription = this.activity_manager.stop_states.subscribe((state: StopState) => {
                stopped = true;
            })
            try {

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
                        console.error('error rendering cell', error, iter_cell);
                        return false;
                    }
                }
                return true;

            } finally {
                stop_states_subscription.unsubscribe();
            }
        }
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

    inject_key_event(key_event: KeyboardEvent): void {
        const active_cell = this.active_cell;
        const target      = key_event.target;
        if (active_cell && target instanceof Node && !active_cell.contains(target as Node)) {
            // try to set target to the currently active cell
            if (active_cell) {
                // this is a clumsy clone of key_event, but it will only be used internally from this point
                // the goal is to clone the event but change target and currentTarget
                key_event = {
                    ...key_event,  // captures almost nothing, e.g., just the "isTrusted" property

                    key:           key_event.key,       // non-enumerable getter
                    metaKey:       key_event.metaKey,   // non-enumerable getter
                    ctrlKey:       key_event.ctrlKey,   // non-enumerable getter
                    shiftKey:      key_event.shiftKey,  // non-enumerable getter
                    altKey:        key_event.altKey,    // non-enumerable getter

                    preventDefault:  key_event.preventDefault.bind(key_event),
                    stopPropagation: key_event.stopPropagation.bind(key_event),

                    target:        active_cell,
                    currentTarget: active_cell,
                };
            }
        }
        this.#key_event_manager.inject_key_event(key_event);
    }

    inject_command(command: string) {
        return this.#perform_command({ dm: this, command, target: this.active_cell });
    }

    // note: an updated command_context with target set to this.active_cell
    // is sent to the command handler.
    #perform_command(command_context: CommandContext<BqManager>): void {
        let success: boolean = false;  // for now...
        try {
            if (command_context) {
                const target = command_context.target;
                if (target) {
                    const updated_command_context = {
                        ...command_context,
                        target: this.active_cell,
                    };
                    const bindings_fn = this.#command_bindings[updated_command_context.command];
                    if (bindings_fn) {
                        if (bindings_fn instanceof AsyncFunction) {
                            bindings_fn(updated_command_context)
                                .then((success: boolean) => {
                                    if (!success) {
                                        beep();
                                    }
                                })
                                .catch((error: unknown) => {
                                    console.error('error performing command', error, command_context);
                                });
                            success = true;  // so far..., a failure may yet happen asynchronously
                        } else {
                            success = bindings_fn(updated_command_context);
                        }
                    }
                }
            }
        } catch (error: unknown) {
            console.error('error processing command', command_context, error);
        }
        if (!success) {
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

            menu.set_menu_state('clear-all',             { enabled: !presentation && editable });

            menu.set_menu_state('save',                  { enabled: !is_neutral && has_save_handle });
            // no update to command 'save-as'
            // no update to command 'export'

            menu.set_menu_state('toggle-auto-eval',      { checked: get_auto_eval(), enabled: !presentation });

            // no update to command 'settings'

            menu.set_menu_state('eval',                  { enabled: interactive && editable && !!active_cell });
            menu.set_menu_state('eval-and-refocus',      { enabled: interactive && editable && !!active_cell });
            menu.set_menu_state('eval-before',           { enabled: interactive && editable && !!active_cell });
            menu.set_menu_state('eval-all',              { enabled: interactive && editable && !!active_cell });

            menu.set_menu_state('stop',                  { enabled: active_cell?.can_stop });
            menu.set_menu_state('stop-all',              { enabled: all_cells.some(cell => cell.can_stop) });

            menu.set_menu_state('reset',                 { enabled: interactive   && editable });
            menu.set_menu_state('reset-all',             { enabled: !presentation && editable });

            menu.set_menu_state('focus-up',              { enabled: interactive && !!active_cell && active_index > 0 });
            menu.set_menu_state('focus-down',            { enabled: interactive && !!active_cell && active_index < cells.length-1 });

            menu.set_menu_state('move-up',               { enabled: !presentation && !!active_cell && active_index > 0 });
            menu.set_menu_state('move-down',             { enabled: !presentation && !!active_cell && active_index < cells.length-1 });
            menu.set_menu_state('add-before',            { enabled: !presentation && editable && !!active_cell });
            menu.set_menu_state('add-after',             { enabled: !presentation && editable && !!active_cell });
            menu.set_menu_state('duplicate',             { enabled: !presentation && editable && !!active_cell });
            menu.set_menu_state('delete',                { enabled: !presentation && editable && !!active_cell });

            menu.set_menu_state('set-type-plain',        { checked: (cell_type === 'plain'),      enabled: interactive });
            menu.set_menu_state('set-type-markdown',     { checked: (cell_type === 'markdown'),   enabled: interactive });
            menu.set_menu_state('set-type-tex',          { checked: (cell_type === 'tex'),        enabled: interactive });
            menu.set_menu_state('set-type-javascript',   { checked: (cell_type === 'javascript'), enabled: interactive });

            menu.set_menu_state('set-view-normal',       { checked: (cell_view === 'normal') });
            menu.set_menu_state('set-view-hide',         { checked: (cell_view === 'hide') });
            menu.set_menu_state('set-view-full',         { checked: (cell_view === 'full') });
            menu.set_menu_state('set-view-none',         { checked: (cell_view === 'none') });
            menu.set_menu_state('set-view-presentation', { checked: (cell_view === 'presentation') });

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
            throw new Error('unexpected: reference cell has a different bq');
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
}
(globalThis as any).BqManager = BqManager;//!!!
