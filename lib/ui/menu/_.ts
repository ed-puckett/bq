const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    create_element,
} from 'lib/ui/dom-tools';

import {
    KeySpec,
    CommandContext,
} from 'lib/ui/key/_';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}


// === MENU CLASS ===

export type MenuCommandBindingsGetter = {
    (): {
        [command: string]: string[],
    }
};

export type MenuOptions = {
    as_menubar?:           boolean,
    persistent?:           boolean,  // remains active and visible?
    get_command_bindings?: MenuCommandBindingsGetter,
};

// css classification classes: toplevel-menu, persistent-menu, menubar, menu, menuitem
// other css classes: disabled, selected, active
// also: menuitem-label, menuitem-separator, menuitem-annotation, collection, collection-arrow

export class Menu<DocumentManager> {
    get CLASS (){ return this.constructor as typeof Menu; }

    static menu_element_tag_name     = 'menu';
    static menuitem_element_tag_name = 'li';

    static small_right_triangle = '\u25B8';  // separator between keys in multiple key sequence glyph

    static find_previous_menuitem(menuitem: HTMLElement) {
        let mi = menuitem.previousElementSibling;
        while (mi && (!mi.classList.contains('menuitem') || mi.classList.contains('disabled'))) {
            mi = mi.previousElementSibling;
        }
        return mi;
    }

    static find_next_menuitem(menuitem: HTMLElement) {
        let mi = menuitem.nextElementSibling;
        while (mi && (!mi.classList.contains('menuitem') || mi.classList.contains('disabled'))) {
            mi = mi.nextElementSibling;
        }
        return mi;
    }

    /** Create a new Menu
     *  (call this static method, not the constructor directly)
     *  @param {StaticDocumentManager} dm the document manager for this menu (used when sending commands)
     *  @param {Element} parent
     *  @param {Array<object>} toplevel_menu_spec: string|[{
     *      ...
     *  }, ... ]
     *  @param {undefined|MenuOptions} options
     *  @return {Menu} menu bar instance initialized as a top-level menu bar
     */
    static create<StaticDocumentManager>( dm:                    StaticDocumentManager,  // static members cannot reference class type parameters
                                          parent:                Element,
                                          toplevel_menu_spec:    (string|object)[],
                                          options?:              MenuOptions
                                        ) {
        return new this<StaticDocumentManager>(dm, parent, toplevel_menu_spec, options);
    }

    #dm: DocumentManager;
    get dm (){ return this.#dm; }

    #commands = new SerialDataSource<CommandContext<DocumentManager>>;
    get commands (){ return this.#commands; }

    #selects = new SerialDataSource<{ select: boolean, target: EventTarget }>();  // select: true is sent before, select: false is sent after
    get selects (){ return this.#selects; }

    #get_command_bindings: undefined|null|MenuCommandBindingsGetter;  // set in constructor
    get get_command_bindings (){ return this.#get_command_bindings; }

    #menu_command_to_elements = new Map<string, Set<HTMLElement>>();
    #menu_container: undefined|HTMLElement;  // set in constructor, set back to undefined in this.remove()

    get element (){ return this.#menu_container; }

    /** constructor for Menu class, used internally; call the static Menu.create() instead.
     *  @param {StaticDocumentManager} dm the document manager for this menu (used when sending commands)
     *  @param {Element} parent
     *  @param {Array<object>} toplevel_menu_spec: string|[{
     *      ...
     *  }, ... ]
     *  @param {undefined|MenuOptions} options
     */
    private constructor( dm:                 DocumentManager,
                         parent:             Element,
                         toplevel_menu_spec: (string|object)[],
                         options?:           MenuOptions,
                       ) {
        const {
            get_command_bindings = () => ({}),
        } = (options ?? {});

        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        if (get_command_bindings !== null && typeof get_command_bindings !== 'undefined' && typeof get_command_bindings !== 'function') {
            throw new Error('get_command_bindings must be null, undefined, or a function');
        }

        this.#dm = dm;
        this.#get_command_bindings = get_command_bindings;
        this.#menu_container = this.#build_toplevel_menu(parent, toplevel_menu_spec, options);
    }

    remove() {
        //!!! is this adequate?
        //!!! remove event handlers, too?
        this.#menu_container?.remove();
        this.#menu_container = undefined;
    }

    /** activate menu
     *  @param {Object} options: {
     *      set_focus?: Boolean,  // set focus, too?
     *  }
     */
    async activate(options?: object): Promise<void> {
        if (this.#menu_container) {
            const {
                set_focus,
            } = (options ?? {}) as any;
            if (!this.#menu_container.querySelector('.selected')) {
                // select the first menuitem of the menu
                const menu_first_menuitem = this.#menu_container.querySelector('.menuitem') as HTMLElement;
                if (menu_first_menuitem) {
                    this.#select_menuitem(menu_first_menuitem);
                }
            }
            if (set_focus) {
                return new Promise<void>(resolve => setTimeout(() => {
                    this.#menu_container?.focus();
                    resolve();
                }));
            } else {
                return;  // resolved immediately
            }
        }
    }

    /** deactivate menu
     */
    deactivate(): void {
        if (this.#menu_container) {
            this.#deactivate_menu(this.#menu_container);
        }
    }

    set_menu_state(command: string, state_spec: { enabled?: boolean, checked?: boolean }) {
        state_spec ??= {};
        if (typeof state_spec !== 'object') {
            throw new Error('state_spec must be an object');
        }
        const elements = this.#menu_command_to_elements.get(command);
        if (!elements) {
            console.warn('set_menu_state() command does not map to any elements', command);
        } else {
            for (const element of elements) {
                for (const [ name, value ] of Object.entries(state_spec ?? {})) {
                    switch (name) {
                        case 'enabled': {
                            if (value) {
                                element.classList.remove('disabled');
                            } else {
                                element.classList.add('disabled');
                            }
                            break;
                        }
                        case 'checked': {
                            if (value) {
                                element.classList.add('checked');
                            } else {
                                element.classList.remove('checked');
                            }
                            break;
                        }
                        default: {
                            throw new Error('unknown state specifier');
                        }
                    }
                }
            }
        }
    }


    // === INTERNAL ===

    /** deactivate the menu that contains the given menuitem and reset all
     *  subordinate state.
     *  @param {HTMLElement|undefined|null} menu_element an HTMLElement object with class "menu"
     */
    #deactivate_menu(menu_element: HTMLElement): void {
        if (menu_element) {
            if (!(menu_element instanceof HTMLElement) || !menu_element.classList.contains('menu')) {
                throw new Error('menu_element must be an HTMLElement with class "menu"');
            }
            if (!menu_element.classList.contains('persistent-menu')) {  // menubar always remains active
                menu_element.classList.remove('active');
            }
            menu_element.classList.remove('selected');
            for (const mi of menu_element.children) {
                mi.classList.remove('selected');
                if (mi.classList.contains('collection')) {
                    this.#deactivate_menu(mi.querySelector('.menu') as HTMLElement);
                }
            }
            if (menu_element.classList.contains('toplevel-menu')) {  // dispatch once, for top-level menu element
                this.selects.dispatch({ select: false, target: menu_element });
            }
        }
    }

    /** select the given menuitem and deselect all others
     *  @param {HTMLElement} menuitem_element
     */
    #select_menuitem(menuitem_element: HTMLElement): void {
        if (!menuitem_element.classList.contains('selected')) {
            // change selection only if not already selected
            const container = menuitem_element.closest('.menu');
            if (!container) {
                throw new Error('unexpected: container not found');
            }
            if (container.classList.contains('toplevel-menu') && !this.#menu_container?.querySelector('.selected')) {
                this.selects.dispatch({ select: true, target: menuitem_element });
            }
            // add .selected to menuitem_element
            menuitem_element.classList.add('selected');
            if (menuitem_element.classList.contains('collection')) {
                // make it "active" so that the submenu is displayed
                menuitem_element.querySelector('.menu')?.classList.add('active');
                // adjust the position of the collection
                const collection = menuitem_element.querySelector('.menu') as HTMLElement;
                const menuitem_element_br = menuitem_element.getBoundingClientRect();
                const parent = menuitem_element.parentElement;
                if (collection && parent) {
                    if (parent.classList.contains('menubar')) {
                        collection.style.top  = `${menuitem_element_br.y + menuitem_element_br.height}px`;
                        collection.style.left = `${menuitem_element_br.x}px`;
                    } else {
                        const collection_br = collection.getBoundingClientRect();
                        const parent_br     = parent.getBoundingClientRect();

                        // menu elements with class "menu" are set to position: absolute
                        // this means that left/top will be relative to menuitem_element x/y

                        const rside_left = menuitem_element_br.width;  // relative to menuitem_element_br.x
                        const lside_left = -collection_br.width;       // relative to menuitem_element_br.x
                        const rside_hidden = menuitem_element_br.x + rside_left + collection_br.width - document.documentElement.clientWidth;
                        const lside_hidden = -(menuitem_element_br.x + lside_left);

                        // minimize the amount of the collection submenu that is hidden (if any)
                        // prefer the right side

                        const left = (rside_hidden <= 0)
                            ? rside_left
                            : ( (lside_hidden <= 0)
                                ? lside_left
                                : ( (rside_hidden <= lside_hidden)
                                    ? (rside_left - rside_hidden)
                                    : (lside_left + lside_hidden) ) );
                        const top = menuitem_element_br.y - parent_br.y;

                        collection.style.left = `${left}px`;
                        collection.style.top  = `${top}px`;
                    }
                }
            }
            // we updated menuitem_element first so that we don't erroneously
            // fire a selects event with select: false while we deselect all
            // other children now
            for (const mi of container.children) {
                if (mi !== menuitem_element) {
                    if (mi instanceof HTMLElement) {
                        this.#deselect_menuitem(mi as HTMLElement);
                    }
                }
            }
        }
    }

    /** deselect the given menuitem
     *  @param {HTMLElement} menuitem_element
     */
    #deselect_menuitem(menuitem_element: HTMLElement): void {
        if (menuitem_element.classList.contains('selected')) {
            menuitem_element.classList.remove('selected');
            const parent = menuitem_element.parentElement;
            if (parent && parent.classList.contains('toplevel-menu') && !this.#menu_container?.querySelector('.selected')) {
                this.selects.dispatch({ select: false, target: menuitem_element });
            }
        }
        if (menuitem_element.classList.contains('collection')) {
            this.#deactivate_menu(menuitem_element.querySelector('.menu') as HTMLElement);
        }
    }

    /** Return a new menu HTMLElement object which represents a separator.
     *  @param {Element} parent
     */
    #build_menu_item_separator(parent: Element): HTMLElement {
        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        const element = create_element({
            parent,
            tag: this.CLASS.menuitem_element_tag_name,
        }) as HTMLElement;
        element.classList.add('disabled', 'menuitem', 'menuitem-separator');
        return element;
    }

    /** Return a new menu HTMLElement object for the given menu_spec.
     *  @param {object|string} menu_spec specification for menu item or collection.
     *         If a string, then create a separator (regardless of the string contents).
     *  @param {Element} parent
     *  @param {boolean} (optional) toplevel if the menu is the top-level menu; default: false
     *  @return {HTMLElement} new menu HTMLElement
     *  Also updates this.#menu_command_to_elements
     */
    #build_menu(menu_spec: string|object, parent: Element, toplevel: boolean = false): HTMLElement {
        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        if (typeof menu_spec === 'string') {
            return this.#build_menu_item_separator(parent);
        }

        const {
            label,
            collection,
            item,
        } = menu_spec as any;

        if (typeof label !== 'string') {
            throw new Error('label must be specified as a string');
        }
        if (item && collection) {
            throw new Error('item and collection must not both be specified');
        }
        if (collection) {
            if (!Array.isArray(collection)) {
                throw new Error('collection must be an array');
            }
        }
        if (item) {
            if (typeof item !== 'object' || typeof item.command !== 'string') {
                throw new Error('item must specify an object with a string property "command"');
            }
        }

        // both items and collections are menuitem elements, but the collection also has children...
        const element = this.#build_menuitem(label, toplevel);

        if (item) {
            this.#add_item_menuitem_annotations_and_click_handler(element, item.command);
            // update this.#menu_command_to_elements
            let currently_mapped_elements = this.#menu_command_to_elements.get(item.command);
            if (!currently_mapped_elements) {
                currently_mapped_elements = new Set();
                this.#menu_command_to_elements.set(item.command, currently_mapped_elements);
            }
            currently_mapped_elements.add(element);
        } else {
            // collection
            element.classList.add('collection');

            const collection_element = create_element({
                parent: element,
                tag:    this.CLASS.menu_element_tag_name,
            }) as HTMLElement;
            collection_element.classList.add('menu');
            if (!toplevel) {
                create_element({
                    parent: element,
                    innerText: '\u25b8',  // right-pointing triangle
                    attrs: {
                        class: [ 'menuitem-annotation', 'collection-arrow' ],
                    },
                });
            }
            if (collection) {
                collection.forEach((spec: unknown) => {
                    if (typeof spec === 'string') {  // note: does not work: (spec instanceof String)
                        this.#build_menu(spec as string, collection_element);
                    } else if (typeof spec === 'object') {
                        this.#build_menu(spec as object, collection_element);
                    }
                });
            }

            if (toplevel) {
                element.addEventListener('click', (event) => {
                    if (event.target instanceof Element && (event.target as Element).closest('.menuitem') === element) {  // make sure click is not in a child (submenu)
                        if (element.classList.contains('selected')) {
                            this.#deselect_menuitem(element);
                        } else {
                            this.#select_menuitem(element);
                        }
                        event.stopPropagation();
                        event.preventDefault();
                    }
                });
            }
        }

        // wait to add to parent until everything else happens without error
        if (parent) {
            parent.appendChild(element);
        }

        return element;
    }

    #build_menuitem(label: string, toplevel: boolean = false): HTMLElement {
        // both items and collections are menuitem elements, but the collection also has children...
        const menuitem = create_element({
            tag: this.CLASS.menuitem_element_tag_name,
            attrs: {
                class: 'menuitem',
            },
        }) as HTMLElement;

        // add the label
        const lbl = create_element({
            parent: menuitem,
            attrs: {
                class: 'menuitem-label',
            },
        }) as HTMLElement;
        lbl.innerText = label;

        menuitem.addEventListener('mousemove', (event) => {
            // don't pop open top-level menus unless one is already selected
            // this means that the user must click the top-level menu to get things started
            if (!toplevel || this.#menu_container?.querySelector('.selected')) {
                if (!menuitem.classList.contains('disabled')) {
                    this.#select_menuitem(menuitem);
                }
            }
        });
        return menuitem;
    }

    #add_item_menuitem_annotations_and_click_handler(menuitem: HTMLElement, command: string): void {
        if (command) {
            const command_bindings = this.get_command_bindings?.();
            if (command_bindings) {
                const kbd_bindings = command_bindings[command];
                if (kbd_bindings) {
                    const kbd_container = create_element({
                        parent: menuitem,
                        attrs: {
                            class: 'menuitem-annotation',
                        },
                    }) as HTMLElement;
                    // create <kbd>...</kbd> elements
                    kbd_bindings.forEach(binding => {
                        const keys = binding.split(KeySpec.canonical_key_string_separator);
                        const binding_glyphs = keys
                            .map(key => new KeySpec(key).glyphs)
                            .join(this.CLASS.small_right_triangle);
                        create_element({
                            parent: kbd_container,
                            tag: 'kbd',
                            innerText: binding_glyphs,
                            attrs: {
                                title: binding,  // "tooltip" with modifier names instead of symbols
                            },
                        });
                    });
                }
            }
        }

        menuitem.addEventListener('click', (event) => {
            const closest_toplevel = menuitem.closest('.toplevel-menu');
            if (closest_toplevel instanceof HTMLElement) {
                this.#deactivate_menu(closest_toplevel);
            }
            const command_context: CommandContext<DocumentManager> = {
                dm:      this.dm,
                command,
                event,
                target:  event.target,
            };
            this.commands.dispatch(command_context);
            event.stopPropagation();
            event.preventDefault();
        });
    }

    static toplevel_contextmenu_label = '\u22ee';  // vertical ellipsis

    #build_toplevel_menu(parent: Element, toplevel_menu_spec: (string|object)[], options?: MenuOptions): HTMLElement {
        const {
            as_menubar,
            persistent,
        } = (options ?? {});

        const menu_container_css_class = [ 'toplevel-menu', 'menu' ];
        if (as_menubar) {
            menu_container_css_class.push('menubar');
            menu_container_css_class.push('active');  // menubar is always active
        }
        if (persistent || as_menubar) {
            menu_container_css_class.push('persistent-menu');
            menu_container_css_class.push('active');  // persistent implies always active
        }
        const menu_container = create_element({
            tag: this.CLASS.menu_element_tag_name,
            parent,
            before: parent.firstChild,  // prepend
            attrs: {
                role:     'navigation',
                tabindex: 0,
                class:    menu_container_css_class,
            },
        }) as HTMLElement;
        if (as_menubar) {
            toplevel_menu_spec.forEach(spec => this.#build_menu(spec, menu_container, true));
        } else {
            this.#build_menu({ label: this.CLASS.toplevel_contextmenu_label, collection: toplevel_menu_spec }, menu_container, true);
        }

        // add event listener to close menu when focus is lost
        menu_container.addEventListener('blur', (event) => {
            this.#deactivate_menu(menu_container);
        });

        // add keyboard navigation event listener
        menu_container.addEventListener('keydown', (event) => {
            const selected_elements = [ ...menu_container.querySelectorAll('.selected') ].filter(e => e instanceof HTMLElement) as HTMLElement[];
            if (selected_elements.length <= 0) {
                if (! ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
                    return;  // do not handle or alter propagation
                } else {
                    // select the first menuitem in the menu_container
                    const menu_first_menuitem = menu_container.querySelector('.menuitem');
                    if (menu_first_menuitem instanceof HTMLElement) {
                        this.#select_menuitem(menu_first_menuitem);
                    }
                }
            } else {
                const menuitem = selected_elements[selected_elements.length-1];

                const is_in_menubar = as_menubar && (menuitem.parentElement === menu_container);

                let key_menu_prev, key_menu_next, key_cross_prev, key_cross_next;
                if (is_in_menubar) {
                    key_menu_prev  = 'ArrowLeft';
                    key_menu_next  = 'ArrowRight';
                    key_cross_prev = 'ArrowUp';
                    key_cross_next = 'ArrowDown';
                } else {
                    key_menu_prev  = 'ArrowUp';
                    key_menu_next  = 'ArrowDown';
                    key_cross_prev = 'ArrowLeft';
                    key_cross_next = 'ArrowRight';
                }

                switch (event.key) {
                    case 'Enter':
                    case ' ': {
                        menuitem.click();
                        break;
                    }
                    case 'Escape': {
                        this.#deactivate_menu(menu_container);
                        break;
                    }
                    case key_menu_prev: {
                        const mi = this.CLASS.find_previous_menuitem(menuitem);
                        if (mi instanceof HTMLElement) {
                            this.#select_menuitem(mi);
                        } else if (!is_in_menubar) {
                            menuitem.classList.remove('selected');  // parent menuitem will still be selected
                        }
                        break;
                    }
                    case key_menu_next: {
                        const mi = this.CLASS.find_next_menuitem(menuitem);
                        if (mi instanceof HTMLElement) {
                            this.#select_menuitem(mi);
                        }
                        break;
                    }
                    case key_cross_prev: {
                        if (!is_in_menubar) {
                            const menubar_menuitem = menu_container.querySelector('.menuitem.selected');
                            const mbi = this.CLASS.find_previous_menuitem(menubar_menuitem as HTMLElement);
                            if (mbi instanceof HTMLElement) {
                                this.#select_menuitem(mbi);
                            }
                        }
                        break;
                    }
                    case key_cross_next: {
                        let navigated_into_collection = false;
                        if (menuitem.classList.contains('collection')) {
                            // enter collection if possible
                            const mi = menuitem.querySelector('.menuitem:not(.disabled)');
                            if (mi instanceof HTMLElement) {
                                this.#select_menuitem(mi);
                                navigated_into_collection = true;
                            }
                        }
                        if (!navigated_into_collection && !is_in_menubar) {
                            const menubar_menuitem = menu_container.querySelector('.menuitem.selected') as HTMLElement;
                            const mbi = this.CLASS.find_next_menuitem(menubar_menuitem);
                            if (mbi instanceof HTMLElement) {
                                this.#select_menuitem(mbi);
                            }
                        }
                        break;
                    }

                    default:
                        return;  // do not handle or alter propagation
                }
            }

            // if we get here, assume the event was handled and therefore
            // we should stop propagation and prevent default action.
            event.stopPropagation();
            event.preventDefault();
        }, {
            capture: true,
        });

        return menu_container;
    }
}
