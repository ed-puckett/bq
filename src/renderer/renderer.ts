import {
    ExtensionManager,
} from './extension-manager';

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


    // === COMMON RENDER HANDLER FOR EXTENSION CLASSES ===

    protected static async _invoke_renderer<ValueType, OptionsType>(
        renderer: { /*async*/ _render( ocx:      OutputContext,
                                       value:    ValueType,
                                       options?: OptionsType ): Promise<Element>,
                  },
        ocx:      OutputContext,
        value:    ValueType,
        options?: OptionsType ): Promise<Element>
    {
        return renderer._render(ocx, value, options)
            .then(result => {
                // Make sure that the ocx is stopped and that the error, if any, is output
                // to the log. If nothing has yet called a function that checks if the ocx
                // if stopped, then BqManager.prototype.render_cells() never gets the
                // corresponding error, and therefore the BqManager.prototype.rendering_cells
                // gets fulfilled, however the ocx is not in a usable state.  So if some cell
                // in the document is awaiting that promise and then tries to use the ocx
                // when it fulfills, an unhandled rejection results.
                // This turns out to be important for document auto-render.
                ocx.abort_if_stopped();
                return result;
            })
            .catch((error: unknown) => {
                try {
                    ocx.stop();  // stop anything that may have been started
                } catch (ignored_error: unknown) {
                    console.error('ignored second-level error while stopping ocx after render error', ignored_error);
                    // nothing
                }
                throw error;
            })
        .finally(() => {
            ocx.render_completions.dispatch({
                ocx,
                renderer: (renderer as unknown) as Renderer,
                value:    value as any,
                options:  options as object,
            });
        });
    }
}


export abstract class TextBasedRenderer extends Renderer {
    static get media_type (){ return `text/${this.type}`; }

    /** render the given value
     * @param {OutputContext} ocx,
     * @param {string} value,  // value to be rendered
     * @param {undefined|TextBasedRendererOptionsType} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx: OutputContext, value: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        return Renderer._invoke_renderer(this, ocx, value, options);
    }

    /** to be implemented by subclasses
     */
    abstract /*async*/ _render(ocx: OutputContext, value: string, options?: TextBasedRendererOptionsType): Promise<Element>;


    // === TEXT RENDERER EXTENSIBILITY ===

    static #extensions = new ExtensionManager();  // note: "extension" here refers to extending the rendering system, and not class extensions

    static factory_for_type(type: string): undefined|RendererFactory {
        return this.#extensions.get(type);
    }

    static renderer_for_type(type: string): undefined|TextBasedRenderer {
        const factory = this.factory_for_type(type);
        if (!factory) {
            return undefined;
        } else {
            const renderer = new factory();
            return renderer as TextBasedRenderer;
        }
    }

    static add_text_renderer_factory(factory: RendererFactory): void {
        this.#extensions.add(factory);
    }

    static remove_text_renderer_factory(factory: RendererFactory): void {
        this.#extensions.remove(factory);
    }

    static get_text_renderer_types(): string[] {
        return this.#extensions.get_all().map(({ type }) => type);
    }

    static get_text_renderer_factories(): RendererFactory[] {
        return this.#extensions.get_all();
    }

    static reset_to_initial_text_renderer_factories() {
        this.#extensions.reset(_initial_text_renderer_factories);
    }
}


/** for use only by initial TextBasedRenderer extensions and this.reset_to_initial_text_renderer_factories();
 */
export const _initial_text_renderer_factories: RendererFactory[] = [];


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
        return Renderer._invoke_renderer(this, ocx, value, options);
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
