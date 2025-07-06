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
} from 'lib/ui/dom-tools';

import {
    sprintf as lib_sprintf,
} from 'lib/sys/sprintf';

import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    StoppedError,
    ActivityManager,
} from 'lib/sys/activity-manager';

import {
    is_compatible_with_options,
} from 'src/renderer/text/types';

import {
    RendererFactory,
    Renderer,
    ErrorRenderer,
    ErrorRendererValueType,
    ErrorRendererOptionsType,
    ImageDataRenderer,
    ImageDataRendererValueType,
    ImageDataRendererOptionsType,
    GraphvizRenderer,
    GraphvizRendererValueType,
    GraphvizRendererOptionsType,
    PlotlyRenderer,
    PlotlyRendererValueType,
    PlotlyRendererOptionsType,
    TextBasedRenderer,
    TextBasedRendererOptionsType,
    TextRenderer,
    MarkdownRenderer,
    LaTeXRenderer,
    JavaScriptRenderer,
    ExtensionManager,
} from 'src/renderer/_';


export type OutputContextRenderCompletion<OutputContextType> = {
    renderer: Renderer,
    ocx:      OutputContextType,
    value?:   any,
    options?: object,
}


const css_class__bq_cell_output         = 'bq-cell-output';
const attribute__data_source_element    = 'data-source-element';
const attribute__data_source_media_type = 'data-source-media-type';

export class OutputContext extends ActivityManager {
    get CLASS (){ return this.constructor as typeof OutputContext; }

    static get css_class__bq_cell_output         (){ return css_class__bq_cell_output; }
    static get attribute__data_source_element    (){ return attribute__data_source_element; }
    static get attribute__data_source_media_type (){ return attribute__data_source_media_type; }

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


    // === STATIC UTILITY METHODS ===

    static sprintf(format: string, ...args: any[]): string {
        return lib_sprintf(format, ...args);
    }

    static async sleep(s: number): Promise<void> {
        return this.delay_ms(1000*s);
    }

    static async delay_ms(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async next_tick(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve));
    }

    static async next_micro_tick(): Promise<void> {
        return new Promise(resolve => queueMicrotask(resolve));
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
     * @param {OutputContext} base_element
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
     * @param {OutputContext} base_ocx
     * @param {undefined|null|TextBasedRendererOptionsType} options
     * @param {Boolean} always_create_child (default: false)
     * @return {OutputContext} ocx compatible with options (may be base_ocx)
     * @throws {Error} error if options does not pass validation
     */
    static ocx_for_options(base_ocx: OutputContext, options?: null|TextBasedRendererOptionsType, always_create_child: Boolean = false): OutputContext {
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

    /** @param {Number} s delay in seconds
     *  @return {Promise} promise which will resolve after s seconds
     */
    async sleep(s: number): Promise<void> {
        this.abort_if_stopped();
        return this.CLASS.sleep(s);
    }

    /** @param {Number} ms delay in milliseconds
     *  @return {Promise} promise which will resolve after ms milliseconds
     */
    async delay_ms(ms: number): Promise<void> {
        this.abort_if_stopped();
        return this.CLASS.delay_ms(ms);
    }

    /** @return {Promise} promise which will resolve after next "tick"
     * setTimeout() is used.
     */
    async next_tick(): Promise<void> {
        this.abort_if_stopped();
        return this.CLASS.next_tick();
    }

    /** @return {Promise} promise which will resolve after next "tick"
     * queueMicrotask() is used.
     */
    async next_micro_tick(): Promise<void> {
        this.abort_if_stopped();
        return this.CLASS.next_micro_tick();
    }

    /** @param {String} format
     *  @param {any[]} args
     *  @return {String} formatted string
     */
    sprintf(format: string, ...args: any[]): string {
        this.abort_if_stopped();
        return this.CLASS.sprintf(format, ...args);
    }


    // === BASIC OPERATIONS ===

    readonly #bq:      BqManager;
    readonly #element: Element;
    readonly #parent:  undefined|OutputContext;

    get bq      (){ return this.#bq; }
    get element (){ return this.#element; }
    get parent  (){ return this.#parent; }

    /** @return {OutputContext} topmost OutputContext starting from this
     * The "topmost" OutputContext is defined as the first OutputContext
     * in the parent chain with no parent or whose parent is on some cycle
     * in the parent chain.
     */
    get topmost (): OutputContext {
        let p: undefined|OutputContext = this;
        for (let tries = 0; tries < 10; tries++) {
            if (!p.parent) {
                return p;
            }
            p = p.parent;
        }
        // after several tries, the topmost parent was not found, so maybe
        // there is a cycle.  Try more carefully:
        p = this;
        const seen = new Set();
        for (;;) {
            seen.add(p);
            if (!p.parent || seen.has(p.parent)) {
                return p;
            }
            p = p.parent;
        }
    }

    /** construct a new OutputContext for the given element and with an optional parent.
     *  @param {Element} element controlled by this new OutputContext
     *  @param {undefined|OutputContext} parent for this new OutputContext
     *  @return {OutputContext}
     * If parent is given, then this new OutputContext is managed by it by
     * calling parent.manage_activity(this).
     */
    constructor(bq: BqManager, element: Element, parent?: OutputContext) {
        super(false);  // ActivityManager base class; multiple_stops = false

        if (!(bq instanceof BqManager)) {
            throw new TypeError('bq must be an instance of BqManager');
        }
        if (!(element instanceof Element)) {
            throw new TypeError('element must be an instance of Element');
        }
        if (parent && parent.bq !== bq) {
            throw new TypeError('parent has a different BqManager');
        }
        this.#bq      = bq;
        this.#element = element;
        this.#parent  = parent;

        parent?.manage_activity(this);
    }

    readonly #render_completions = new SerialDataSource<OutputContextRenderCompletion<OutputContext>>
    get render_completions (){ return this.#render_completions; }


    // === BASIC OPERATIONS ===

    /** remove all child elements and nodes of this.element via this.CLASS.clear_element()
     */
    clear(): void {
        this.abort_if_stopped();
        this.CLASS.clear_element(this.element);
    }

    /** set attributes on an element which are taken from an object, via this.CLASS.set_element_attrs()
     */
    set_attrs(attrs: { [attr: string]: undefined|null|string }): void {
        this.abort_if_stopped();
        this.CLASS.set_element_attrs(this.element, attrs);
    }

    /** add/remove style properties on this.element via this.CLASS.update_element_style()
     * Throws an error if this.element is not an instance of HTMLElement.  //!!!
     */
    update_style(spec: { [prop: string]: undefined|null|string }): void {
        this.abort_if_stopped();
        if (! (this.element instanceof HTMLElement)) {
            throw new TypeError('this.element must be an instance of HTMLElement');
        }
        this.CLASS.update_element_style((this.element as HTMLElement), spec);
    }

    /** create a new child element of this.element via this.CLASS.create_element_child()
     *  See this.CLASS.create_element() for a description of options.
     *  @return {Element|object} the new child element or a mapping if return_mapping.
     */
    create_child_or_mapping(options?: object, return_mapping?: boolean): Element|object {
        this.abort_if_stopped();
        return this.CLASS.create_element_child_or_mapping(this.element, options, !!return_mapping);
    }

    /** create a new child element of this.element via this.CLASS.create_element_child()
     *  See this.CLASS.create_element() for a description of options.
     *  @return {Element|object} the new child element or a mapping if return_mapping.
     */
    create_child(options?: object): Element {
        this.abort_if_stopped();
        return this.CLASS.create_element_child(this.element, options);
    }

    /** create a new child element of this.element via this.CLASS.create_element_child_mapping() and return a mapping.
     *  See this.CLASS.create_element() for a description of options.
     *  @return {Element|object} the new child element or a mapping if return_mapping.
     */
    create_child_mapping(options?: object): object {
        this.abort_if_stopped();
        return this.create_child_or_mapping(options, true);
    }

    /** create a new OutputContext from the given element
     *  @param {Element} element the target element
     *  @param {undefined|OutputContext} parent
     *  @return {OutputContext} the new OutputContext object
     * The new ocx will have multiple_stops = false.
     */
    create_new_ocx(element: Element, parent?: OutputContext): OutputContext {  // multiple_stops = false
        this.abort_if_stopped();
        if (parent && parent.bq !== this.bq) {
            throw new TypeError('parent has a different BqManager');
        }
        return new OutputContext(this.bq, element, parent);
    }

    /** create a new OutputContext from a new child element of this.element created via this.create_child()
     *  @param {undefined|object} options to be passed to create_element()
     *  @return {OutputContext} the new child OutputContext
     * the new ocx will be managed by this ocx. The new ocx will have
     * multiple_stops = false.
     */
    create_child_ocx(options?: object): OutputContext {  // multiple_stops = false
        this.abort_if_stopped();
        options ??= {};
        const element_style_attr = this.element.getAttribute('style');
        if (element_style_attr) {
            (options as any).attrs = {
                ...((options as any).attrs ?? {}),
                style: element_style_attr,  // inherit element's style attribute (vs style)
            };
        }
        const child_ocx = new OutputContext(this.bq, this.create_child(options), this);
        return child_ocx;
    }

    is_visible(element: Element, vpos: undefined|null|number, hpos: undefined|null|number): boolean {
        this.abort_if_stopped();
        return this.CLASS.element_is_visible(this.element, vpos, hpos);
    }

    is_scrollable(): boolean {
        this.abort_if_stopped();
        return this.CLASS.element_is_scrollable(this.element);
    }

    scrollable_parent(): null|Element {
        this.abort_if_stopped();
        return this.CLASS.element_scrollable_parent(this.element);
    }


    // === ADVANCED OPERATIONS ===

    async render_value(value: any, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        // transform value to text and then render as text
        let text: string;
        if (typeof value === 'undefined') {
            text = '[undefined]';
        } else if (typeof value?.toString === 'function') {
            text = value.toString();
        } else {
            text = '[unprintable value]';
        }
        return this.print(text, options);
    }

    async render_error(error: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element> {
        // don't call this.abort_if_stopped() for render_error() so that errors can still be rendered
        // also, call the synchronous ErrorRenderer,render_sync() method.
        if (error instanceof StoppedError) {
            options = { ...(options ?? {}), abbreviated: true };
        }
        return ErrorRenderer.render_sync(this, error, options);
    }

    async print(text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        text ??= '';
        if (typeof text !== 'string') {
            text = (text as any)?.toString?.() ?? '';
        }
        return new TextRenderer().render(this, text, options);
    }

    async println(text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        return this.print((text ?? '') + '\n', options);
    }

    async tty(text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        text ??= '';
        if (typeof text !== 'string') {
            text = (text as any)?.toString?.() ?? '';
        }
        options ??= {};
        options.style ??= {};
        if (!Object.hasOwn(options.style, 'font-family') && !Object.hasOwn(options.style, 'fontFamily')) {
            (options.style as any)['font-family'] = 'monospace';
        }
        return new TextRenderer().render(this, text, options);
    }

    async ttyln(text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        return this.tty((text ?? '') + '\n', options);
    }

    async printf(format: string, ...args: any[]): Promise<Element> {
        let text: string;
        if (typeof format === 'undefined' || format === null) {
            text = '';
        } else {
            if (typeof format !== 'string' && typeof (format as any).toString === 'function') {
                format = (format as any).toString();
            }
            text = this.CLASS.sprintf(format, ...args);
        }
        return this.print(text, { inline: true });
    }

    async print__(options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return this.CLASS.ocx_for_options(this, options)
            .create_child({ tag: 'hr' });
    }

    async javascript(code: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new JavaScriptRenderer().render(this, code, options);
    }

    async markdown(code: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new MarkdownRenderer().render(this, code, options);
    }

    async latex(code: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new LaTeXRenderer().render(this, code, options);
    }

    async image_data(code: ImageDataRendererValueType, options?: ImageDataRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new ImageDataRenderer().render(this, code, options);
    }

    async graphviz(code: GraphvizRendererValueType, options?: GraphvizRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new GraphvizRenderer().render(this, code, options);
    }

    async plotly(code: PlotlyRendererValueType, options?: PlotlyRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new PlotlyRenderer().render(this, code, options);
    }


    // === RENDERER EXTENSIBILITY ===

    /** extensions provides a means of specifying ocx-local mapping of type to RendererFactory
     */
    readonly #extensions = new ExtensionManager();

    get extensions (){ return this.#extensions; }

    text_renderer_factory_for_type(type: string): undefined|RendererFactory {
        for (let hosting_ocx: undefined|OutputContext = this; hosting_ocx; hosting_ocx = hosting_ocx.parent) {
            const factory = hosting_ocx.extensions.get(type);
            if (factory) {
                return factory;
            }
        }
        // not found in this.extensions, fall back to TextBasedRenderer factory mapping
        return TextBasedRenderer.factory_for_type(type);
    }

    text_renderer_for_type(type: string): undefined|TextBasedRenderer {
        const factory = this.text_renderer_factory_for_type(type);
        if (!factory) {
            return undefined;
        } else {
            const renderer = new factory();
            return renderer as TextBasedRenderer;
        }
    }

    async invoke_renderer_for_type( type:     string,
                                    value:    string,
                                    options?: TextBasedRendererOptionsType ): Promise<Element> {
        const renderer = this.text_renderer_for_type(type);
        if (!renderer) {
            throw new Error(`renderer not found for type \"${type}\"`);
        }

        return renderer.render(this, value, options)
            .then(element => {
                if (!this.keepalive) {
                    this.stop();  // stop anything that may have been started
                }
                return element;
            })
            .catch((error) => {
                const error_message_element = ErrorRenderer.render_sync(this, error, { abbreviated: true });
                error_message_element.scrollIntoView(false);
                if (!this.keepalive) {
                    this.stop();  // stop anything that may have been started
                }
                throw error;
            });
    }
}
