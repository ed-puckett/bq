// subordinate types for circularly-dependent Renderer and OutputContext types

import {
    BqManager,
} from 'src/bq-manager/_';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    clear_element,
    set_element_attrs,
    update_element_style,
    create_element_or_mapping,
    create_element,
    create_element_mapping,
    is_visible,
    is_scrollable,
    scrollable_parent,
    delay_ms        as tools_delay_ms,
    next_tick       as tools_next_tick,
    next_micro_tick as tools_next_micro_tick,
} from 'lib/ui/dom-tools';

import {
    sprintf as lib_sprintf,
} from 'lib/sys/sprintf';

import {
    ActivityManager,
} from 'lib/sys/activity-manager';

import {
    TextBasedRendererOptionsType,
    is_compatible_with_options,
} from 'src/renderer/text/types';

import {
    ErrorRendererValueType,
    ErrorRendererOptionsType,
    ImageDataRendererValueType,
    ImageDataRendererOptionsType,
    GraphvizRendererValueType,
    GraphvizRendererOptionsType,
    PlotlyRendererValueType,
    PlotlyRendererOptionsType,
} from 'src/renderer/application/types';


// NOTE: 'async' modifier cannot be used with 'abstract' modifier.
// The implementation in _.ts will use the async modifier, however.


const css_class__bq_cell_output         = 'bq-cell-output';
const attribute__data_source_element    = 'data-source-element';
const attribute__data_source_media_type = 'data-source-media-type';

export abstract class OutputContextLike extends ActivityManager {
    get CLASS (){ return this.constructor as typeof OutputContextLike; }

    static get css_class__bq_cell_output         (){ return css_class__bq_cell_output; }
    static get attribute__data_source_element    (){ return attribute__data_source_element; }
    static get attribute__data_source_media_type (){ return attribute__data_source_media_type; }

    constructor() {
        super(false);  // ActivityManager base class; multiple_stops = false
    }

    abstract get bq      (): BqManager;
    abstract get element (): Element;
    abstract get parent  (): undefined|OutputContextLike;

    #keepalive: boolean = false;
    get keepalive (){ return this.#keepalive; }
    set keepalive (new_state: boolean){
        new_state = !!new_state;
        // set for this ocx and all ancestors
        this.#keepalive = new_state;
        if (this.parent && new_state) {
            // if setting to true, recusively set for all ancestors
            this.parent.keepalive = new_state;
        }
    }


    // === STATIC UTILITY ===

    static sprintf(format: string, ...args: any[]): string {
        return lib_sprintf(format, ...args);
    }

    static async sleep(s: number): Promise<void> {
        return tools_delay_ms(1000*s);
    }

    static async delay_ms(ms: number): Promise<void> {
        return tools_delay_ms(ms);
    }

    static async next_tick(): Promise<void> {
        return tools_next_tick();
    }

    static async next_micro_tick(): Promise<void> {
        return tools_next_micro_tick();
    }


    // === STATIC METHODS ===

    static get_svg_string(svg_node: Node): string {
        const serializer = new XMLSerializer();
        let svg_string = serializer.serializeToString(svg_node);
        svg_string = svg_string.replace(/(\w+)?:?xlink=/g, 'xmlns:xlink=');  // fix root xlink without namespace
        svg_string = svg_string.replace(/NS\d+:href/g, 'xlink:href');  // Safari NS namespace fix
        return svg_string;
    }

    /** create an output element for the given cell and source media type
     * @param {BqCellElement} cell
     * @param {string} source_media_type
     * @return {HTMLOutputElement} output element
     */
    static create_cell_output(cell: BqCellElement, source_media_type: string): HTMLOutputElement {
        if (!cell.id) {
            throw new TypeError('cell must have an id');
        }
        return this.create_element({
            tag: 'output',
            parent: cell.parentElement,
            before: cell.nextSibling,
            attrs: {
                class:                                    this.css_class__bq_cell_output,
                [this.attribute__data_source_element]:    cell.id,
                [this.attribute__data_source_media_type]: source_media_type,
            },
        }) as HTMLOutputElement;
    }

    /** Validate options (throwing an Error if validation does not pass), and
     * return undefined if element is already compatible, otherwise return an
     * object that reflects options that is suitable to use for create_element().
     * If always_return_options is true, then return the creation options
     * regardless of element compatibility.
     * @param {Element} element
     * @param {undefined|null|TextBasedRendererOptionsType} options
     * @param {Boolean} always_return_options (default: false)
     * @return {undefined|Object} transformed options
     * @throws {Error} error if options does not pass validation
     */
    static is_compatible_with_options(element: Element, options?: null|TextBasedRendererOptionsType, always_return_options: Boolean = false): undefined|Object {
        if (!(element instanceof Element)) {
            throw new TypeError('element must be an instance of Element');
        }
        return is_compatible_with_options(element, options, always_return_options);
    }

    /** Return an element that is compatible with options.  The returned
     * element will be base_element if base_element is already compatible,
     * otherwise it will be a child element of base_element.
     * If always_create_child is true, then always return a child.
     * Note that if a new element is returned it is either a <div> or a <span>
     * and is therefore an HTMLElement.
     * @param {OutputContextLike} base_element
     * @param {undefined|null|TextBasedRendererOptionsType} options
     * @param {Boolean} always_create_child (default: false)
     * @return {Element} element compatible with options (may be base_element)
     * @throws {Error} error if options does not pass validation
     */
    static element_for_options(base_element: Element, options?: null|TextBasedRendererOptionsType, always_create_child: Boolean = false): Element {
        const creation_options = this.is_compatible_with_options(base_element, options, always_create_child);
        if (!creation_options) {
            return base_element;
        } else {
            (creation_options as any).parent = base_element;
            return this.create_element(creation_options);
        }
    }

    /** Return an ocx whose element is compatible with options.  The returned
     * ocx will be base_ocx if base_ocx is already compatible, otherwise it
     * will be a child ocx of base_ocx.
     * If always_create_child is true, then always return a child.
     * @param {OutputContextLike} base_ocx
     * @param {undefined|null|TextBasedRendererOptionsType} options
     * @param {Boolean} always_create_child (default: false)
     * @return {OutputContextLike} ocx compatible with options (may be base_ocx)
     * @throws {Error} error if options does not pass validation
     */
    static ocx_for_options(base_ocx: OutputContextLike, options?: null|TextBasedRendererOptionsType, always_create_child: Boolean = false): OutputContextLike {
        const creation_options = this.is_compatible_with_options(base_ocx.element, options, always_create_child);
        if (!creation_options) {
            return base_ocx;
        } else {
            return base_ocx.create_child_ocx(creation_options);
        }
    }

    /** remove all child elements and nodes of element
     *  @param {Node} element
     *  @return {Node} element
     */
    static clear_element(element: Node): void {
        clear_element(element);
    }

    /** set attributes on an element which are taken from an object.
     *  @param {Element} element
     *  @param {Object|undefined|null} attrs
     *  @return {Element} element
     *  Attribute values obtained by calling toString() on the values in attrs
     *  except that values which are undefined are translated to ''.
     */
    static set_element_attrs(element: Element, attrs: { [attr: string]: undefined|null|string }): void {
        set_element_attrs(element, attrs);
    }

    /** add/remove style properties on element
     *  @param {HTMLElement} element
     *  @param {Object} spec collection of properties to add or remove.
     *                  If the value of an entry is null or undefined, then
     *                  the corresponding property is removed.  If the value
     *                  of an entry is null, then the property is removed.
     *                  If the value of an entry is undefined, then that
     *                  entry is ignored.  Otherwise, the value of the
     *                  corresponding property is set.
     *  @return {HTMLElement} element
     */
    static update_element_style(element: HTMLElement, spec: { [prop: string]: undefined|null|string }): void {
        update_element_style(element, spec);
    }

    /** create_element_or_mapping(options?: object, return_mapping=false)
     *  create a new element with the given characteristics
     *  @param {Object|undefined|null} options: {
     *      _key?:      String,     // if return_mapping, associate the created element with this value as the key
     *      parent?:    Node|null,  // parent element, null or undefined for none; may be simply an Element if style not specified
     *      before?:    Node|null,  // sibling node before which to insert; append if null or undefined
     *      tag?:       string,     // tag name for new element; default: 'div'
     *      namespace?: string,     // namespace for new element creation
     *      attrs?:     object,     // attributes to set on new element
     *      style?:     object,     // style properties for new element
     *      set_id?:    Boolean     // if true, allocate and set an id for the element (if id not specified in attrs)
     *      children?:  ELDEF[],    // array of children to create (recursive)
     *      innerText?: string,     // innerText to set on element (invalid if "children" or "innerHTML" specified)
     *      innerHTML?: string,     // innerHTML to set on element (invalid if "children" or "innerText" specified)
     *  }
     *  @param {Boolean} return_mapping (default false)
     *  @return {Element|Object} the new element or the element mapping object
     *
     * A unique id will be assigned to the element unless that element already has
     * an id attribute specified (in attrs).
     * Attributes specified in attrs with a value of undefined are ignored.
     * The before node, if specified, must have a parent that must match parent if
     * parent is specified.
     * If neither parent nor before is specified, the new element will have no parent.
     * Warning: '!important' in style specifications does not work!  (Should use priority method.)
     * The definitions in "children", if specified, should not contain "parent" or "before".
     * attrs may contain a "class" property, and this should be a string or an array of strings,
     * each of which must not contain whitespace.
     *
     * If return_mapping, then return a mapping object from keys found in "_key" properties
     * in the options.  Each of these keys will be mapped to the corresponding object, and
     * mapping_default_key is mapped to the top-level object.  Note that duplicate keys or
     * keys that specify the same value as mapping_default_key will overwrite earlier values.
     * Elements specified in options are created in a post-order traversal of options.children.
     * This means that a _key specified in options as mapping_default_key will not be returned
     * because mapping_default_key is set after traversiing the children.
     */
    static create_element_or_mapping(options?: object, return_mapping: boolean = false): Element|object {
        return create_element_or_mapping(options, return_mapping);
    }

    static create_element(options?: object): Element {
        return create_element(options);
    }

    /** create a element with the given characteristics and return a mapping.
     *  See this.create_element() for a description of options.
     */
    static create_element_mapping(options?: object): object {
        return create_element_mapping(options);
    }

    /** create a new child element of the given element with the given characteristics
     *  See this.create_element_or_mapping() for a description of options.
     */
    static create_element_child_or_mapping(element: Node, options?: object, return_mapping: boolean = false): Element|object {
        if (typeof (options as any)?.parent !== 'undefined' || typeof (options as any)?.before !== 'undefined') {
            console.warn('options.parent and/or options.before override element argument');
        } else {
            options = {
                ...(options ?? {}),
                parent: element,
                before: null,
            };
        }
        return create_element_or_mapping(options, return_mapping);
    }

    /** create a new child element of the given element with the given characteristics and return a mapping.
     *  See create_element_mapping() for a description of options.
     */
    static create_element_child(element: Node, options?: object): Element {
        return this.create_element_child_or_mapping(element, options) as Element;
    }

    /** create a new child element of the given element with the given characteristics and return a mapping.
     *  See create_element_mapping() for a description of options.
     */
    static create_element_child_mapping(element: Node, options?: object): object {
        return this.create_element_child_or_mapping(element, options, true);
    }

    /** Test if element is in DOM and visible.
     * @param {Element} element
     * @param {undefined|null|number} vpos
     * @param {undefined|null|number} hpos
     * @return {Boolean} visible with respect to vpos and hpos
     * vpos and hpos specify which point in the element should be tested
     * where null specifies not checking that direction (v or h) at all,
     * undefined (or parameter omitted) specifies checking that the element
     * is fully visible, and a number specifies a fraction used to check that
     * a single point is visible where the point the fraction of the length in
     * that dimension.  For example, hpos === 0 means check at the beginning,
     * hpos === 1 means check at the end, and hpos === 0.5 means check the middle.
     */
    static element_is_visible(element: Element, vpos: undefined|null|number, hpos: undefined|null|number): boolean {
        return is_visible(element, vpos, hpos);
    }

    /** return a boolean indicating whether the given element is scrollable or not
     * @param {Element} element
     * @return {Boolean} element is scrollable
     */
    static element_is_scrollable(element: Element): boolean {
        return is_scrollable(element);
    }

    /** return the first scollable parent of element
     * @param {Element} element
     * @return {null|Element} first parent element that is scrollable, or null if none
     */
    static element_scrollable_parent(element: Element): null|Element {
        return scrollable_parent(element);
    }


    // === ABORT IF STOPPED ===

    /** abort by throwing an Error if this.stopped, otherwise do nothing.
     *  (implemented via this.abort_signal.throwIfAborted() where this.abort_signal
     *  is defined by the base class ActivityManager.)
     */
    abort_if_stopped(): void {
        this.abort_signal.throwIfAborted();
    }

    /** wrap the given function so that when it is called,
     *  this.abort_if_stopped() will be called first to
     *  terminate rendering if necessary.
     */
    AIS(f: Function): Function {
        if (typeof f !== 'function') {
            throw new TypeError('f must be a function');
        }
        const AsyncFunction = (async () => {}).constructor;
        if (f instanceof AsyncFunction) {
            return async (...args: any[]): Promise<any> => {
                this.abort_if_stopped();
                return f.apply(null, args).then((result: any) => {
                    this.abort_if_stopped();
                    return result;
                });
            };
        } else {
            return (...args: any[]): any => {
                this.abort_if_stopped();
                const result = f.apply(null, args);
                this.abort_if_stopped();
                return result;
            };
        }
    }


    // === UTILITY ===

    /** @param {String} format
     *  @param {any[]} args
     *  @return {String} formatted string
     */
    sprintf(format: string, ...args: any[]): string {
        this.abort_if_stopped();
        return OutputContextLike.sprintf(format, ...args);
    }

    /** @param {Number} s delay in seconds
     *  @return {Promise} promise which will resolve after s seconds
     */
    async sleep(s: number): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.delay_ms(1000*s);
    }

    /** @param {Number} ms delay in milliseconds
     *  @return {Promise} promise which will resolve after ms milliseconds
     */
    async delay_ms(ms: number): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.delay_ms(ms);
    }

    /** @return {Promise} promise which will resolve after next "tick"
     * setTimeout() is used.
     */
    async next_tick(): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.next_tick();
    }

    /** @return {Promise} promise which will resolve after next "tick"
     * queueMicrotask() is used.
     */
    async next_micro_tick(): Promise<void> {
        this.abort_if_stopped();
        return OutputContextLike.next_micro_tick();
    }


    // === BASIC OPERATIONS ===

    abstract clear(): void;
    abstract set_attrs(attrs: { [attr: string]: undefined|null|string }): void;
    abstract update_style(spec: { [prop: string]: undefined|null|string }): void;
    abstract create_child_or_mapping(options?: object, return_mapping?: boolean): Element|object;
    abstract create_child(options?: object): Element;
    abstract create_child_mapping(options?: object): object;
    abstract create_new_ocx(element: Element, parent?: OutputContextLike): OutputContextLike;
    abstract create_child_ocx(options?: object): OutputContextLike;
    abstract is_visible(element: Element, vpos: undefined|null|number, hpos: undefined|null|number): boolean;
    abstract is_scrollable(): boolean;
    abstract scrollable_parent(): null|Element;


    // === ADVANCED OPERATIONS ===

    abstract /*async*/ render_text(text: string, options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ render_error(error: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element>;
    abstract /*async*/ render_value(value: any, options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ println(text: string, options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ printf(format: string, ...args: any[]): Promise<Element>;
    abstract /*async*/ print__(options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ javascript(code: string, options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ markdown(code: string, options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ latex(code: string, options?: TextBasedRendererOptionsType): Promise<Element>;
    abstract /*async*/ image_data(code: ImageDataRendererValueType, options?: ImageDataRendererOptionsType): Promise<Element>;
    abstract /*async*/ graphviz(code: GraphvizRendererValueType, options?: GraphvizRendererOptionsType): Promise<Element>;
    abstract /*async*/ plotly(code: PlotlyRendererValueType, options?: PlotlyRendererOptionsType): Promise<Element>;
}
