import {
    ApplicationBasedRenderer,
} from 'src/renderer/renderer';

import {
    ErrorRendererValueType,
    ErrorRendererOptionsType,
} from './types';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    create_element,
} from 'lib/ui/dom-tools';


export class ErrorRenderer extends ApplicationBasedRenderer<ErrorRendererValueType, ErrorRendererOptionsType> {
    get CLASS () { return this.constructor as typeof ErrorRenderer; }

    static get type (){ return 'error'; }

    static error_element_class = 'error-message';

    /** Render the given error_object to ocx.
     * @param {OutputContextLike} ocx,
     * @param {Error|String} error_object,
     * @param {Object|undefined|null} options: {
     *     style?: Object,  // css style to be applied to output element
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, error_object: ErrorRendererValueType, options?: ErrorRendererOptionsType): Promise<Element> {
        return this.CLASS.render_sync(ocx, error_object, options);
    }

    /** Non-async; used internally to render errors without abort_if_stopped() checks.
     *  Also used by MarkdownRenderer.
     *  No ocx methods are called to avoid tripping over an abort_if_stopped error.
     */
    static render_sync(ocx: OutputContextLike, error_object: ErrorRendererValueType, options?: ErrorRendererOptionsType): Element {
console.log(error_object);//!!! for debugging from console
        const {
            style,
            abbreviated,
        } = (options || {});

        const text_segments = [];
        if (error_object instanceof Error) {
            text_segments.push(error_object.message ?? 'error');
            if (!abbreviated && error_object.stack) {
                text_segments.push(error_object.stack);
            }
        } else {
            text_segments.push(error_object ?? 'error');
        }
        const text = text_segments.join('\n');

        // create the parent element using the dom-tools interface, not the ocx,
        // to avoid triggering an abort_if_stopped error.
        const parent = create_element({
            parent: ocx.element,
            tag: 'pre',
            attrs: {
                class: this.error_element_class,
                [OutputContextLike.attribute__data_source_media_type]: this.media_type,
            },
            style,
        }) as HTMLElement;
        parent.innerText = text;  // innerText sanitizes text

        return parent;
    }
}
