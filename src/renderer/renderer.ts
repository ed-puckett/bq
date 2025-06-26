import {
    text_renderer_factory_for_type,
    reset_to_initial_text_renderer_factories,
    get_text_renderer_factories,
    set_text_renderer_factories,
    add_text_renderer_factory,
    remove_text_renderer_factory,
} from './factories';

import {
    TextBasedRendererOptionsType,
} from './text/types';

import {
    OutputContext,
} from 'src/output-context';


export interface RendererFactory {
    new (): Renderer;
    type: string;
};

export function is_RendererFactory(thing: any): boolean {
    // could be better...
    return (typeof thing === 'function' && typeof thing.type === 'string');
}


export class Renderer {
    /** type which instances handle, to be overridden in subclasses
     */
    static get type (){ return ''; }

    static get media_type (){ return `???/${this.type}`; }

    /** get the type specified by the class
     */
    get type (){ return (this.constructor as typeof Renderer).type; }

    /** get the media_type specified by the class
     */
    get media_type (){ return (this.constructor as typeof Renderer).media_type; }
}


export abstract class TextBasedRenderer extends Renderer {
    static get media_type (){ return `text/${this.type}`; }

    static get_renderer_types():       string[] { return get_text_renderer_factories().map(rf => rf.type); }
    static reset_renderer_factories(): void     { reset_to_initial_text_renderer_factories(); }

    static factory_for_type(type: string):  undefined|RendererFactory { return text_renderer_factory_for_type(type); }
    static renderer_for_type(type: string): undefined|TextBasedRenderer {
        const factory = text_renderer_factory_for_type(type);
        if (!factory) {
            return undefined;
        } else {
            const renderer = new factory();
            return renderer as TextBasedRenderer;
        }
    }

    static get_renderer_factories():                                 RendererFactory[] { return get_text_renderer_factories(); }
    static set_renderer_factories(new_factories: RendererFactory[]): void              { set_text_renderer_factories(new_factories); }
    static add_renderer_factory(rf: RendererFactory):                void              { add_text_renderer_factory(rf); }

    static remove_renderer_factory(rf: RendererFactory):   void { remove_text_renderer_factory(rf); }
    static remove_renderer_factory_for_type(type: string): void {
        const factory = this.factory_for_type(type);
        if (factory) {
            this.remove_renderer_factory(factory);
        }
    }

    /** render the given value
     * @param {OutputContext} ocx,
     * @param {string} value,  // value to be rendered
     * @param {undefined|TextBasedRendererOptionsType} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx: OutputContext, value: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        return ocx._invoke_renderer(this, value, options);
    }

    /** to be implemented by subclasses
     */
    abstract /*async*/ _render(ocx: OutputContext, value: string, options?: TextBasedRendererOptionsType): Promise<Element>;
}


export abstract class ApplicationBasedRenderer<ValueType, OptionsType> extends Renderer {
    static get media_type (){ return `application/${this.type}`; }

    /** render the given value
     * @param {OutputContext} ocx,
     * @param {ValueType} value,  // value appropriate to type (determined by subclass)
     * @param {OptionsType} options?: {
     *     style?:        Object,   // css style to be applied to output element
     *     inline?:       Boolean,  // render inline vs block?
     *     global_state?: Object,   // global_state for rendering; default: ocx.bq.global_state using ocx passed to render()
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx: OutputContext, value: ValueType, options?: OptionsType): Promise<Element> {
        return ocx._invoke_renderer(this, value, options);
    }

    /** to be implemented by subclasses
     */
    abstract /*async*/ _render(ocx: OutputContext, value: ValueType, options?: OptionsType): Promise<Element>;
}


export class LocatedError extends Error {
    constructor( message:      string,
                 line_number:  number,
                 column_index: number,
                 ocx:          OutputContext,
                 options?:     { cause?: unknown } ) {
        super(message, options);
        this.#ocx = ocx;
        this.#line_number  = line_number;
        this.#column_index = column_index;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    #line_number:  number;
    #column_index: number;
    #ocx:          OutputContext;

    get line_number  (){ return this.#line_number; }
    get column_index (){ return this.#column_index; }

    get ocx (){ return this.#ocx; }
}
