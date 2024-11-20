import {
    BqManager,
} from 'src/bq-manager/_';

import {
    OutputContextLike,
    StoppedError,
} from './types';

import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    ActivityManager,
} from 'lib/sys/activity-manager';

import {
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
    CanvasImageRenderer,
    CanvasImageRendererValueType,
    CanvasImageRendererOptionsType,
    TextBasedRenderer,
    TextBasedRendererOptionsType,
    TextRenderer,
    MarkdownRenderer,
    LaTeXRenderer,
    JavaScriptRenderer,
} from 'src/renderer/_';


export class OutputContext extends OutputContextLike {
    // static utility methods are defined in OutputContextLike

    // get/set keepalive are defined in OutputContextLike

    // abort_if_stopped() and AIS() are defined in OutputContextLike

    // sprintf(), sleep(), delay_ms(), next_tick(), next_micro_tick() are defined in OutputContextLike

    readonly #bq:      BqManager;
    readonly #element: Element;
    readonly #parent:  undefined|OutputContextLike;

    get bq      (){ return this.#bq; }
    get element (){ return this.#element; }
    get parent  (){ return this.#parent; }

    /** construct a new OutputContext for the given element and with an optional parent.
     *  @param {Element} element controlled by this new OutputContext
     *  @param {undefined|OutputContextLike} parent for this new OutputContext
     *  @return {OutputContext}
     * If parent is given, then this new OutputContext is managed by it by
     * calling parent.manage_activity(this).
     */
    constructor(bq: BqManager, element: Element, parent?: OutputContextLike) {
        super();
        if (!(bq instanceof BqManager)) {
            throw new Error('bq must be an instance of BqManager');
        }
        if (!(element instanceof Element)) {
            throw new Error('element must be an instance of Element');
        }
        if (parent && parent.bq !== bq) {
            throw new Error('parent has a different BqManager');
        }
        this.#bq      = bq;
        this.#element = element;
        this.#parent  = parent;

        parent?.manage_activity(this);
    }


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
            throw new Error('this.element must be an instance of HTMLElement');
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
     *  @param {undefined|OutputContextLike} parent
     *  @return {OutputContext} the new OutputContext object
     * The new ocx will have multiple_stops = false.
     */
    create_new_ocx(element: Element, parent?: OutputContextLike): OutputContext {  // multiple_stops = false
        this.abort_if_stopped();
        if (parent && parent.bq !== this.bq) {
            throw new Error('parent has a different BqManager');
        }
        return new OutputContext(this.bq, element, parent);
    }

    /** create a new OutputContext from a new child element of this.element created via this.create_child()
     *  @param {undefined|object} options to be passed to create_element()
     *  @return {OutputContextLike} the new child OutputContext
     * the new ocx will be managed by this ocx. The new ocx will have
     * multiple_stops = false.
     */
    create_child_ocx(options?: object): OutputContextLike {  // multiple_stops = false
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

    async render_text(text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        text ??= '';
        if (typeof text !== 'string') {
            text = (text as any)?.toString?.() ?? '';
        }
        return new TextRenderer().render(this, text, options);
    }

    async render_error(error: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element> {
        // don't call this.abort_if_stopped() for render_error() so that errors can still be rendered
        // also, call the synchronous ErrorRenderer,render_sync() method.
        if (error instanceof StoppedError) {
            options = { ...(options ?? {}), abbreviated: true };
        }
        return ErrorRenderer.render_sync(this, error, options);
    }

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
        return this.render_text(text, options);
    }

    async println(text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        return this.render_text((text ?? '') + '\n', options);
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
        return this.render_text(text)
    }

    async print__(options?: TextBasedRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return this.create_child({ tag: 'hr' });
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

    async canvas_image(canvas_renderer: CanvasImageRendererValueType, options?: CanvasImageRendererOptionsType): Promise<Element> {
        this.abort_if_stopped();
        return new CanvasImageRenderer().render(this, canvas_renderer, options);
    }
}
