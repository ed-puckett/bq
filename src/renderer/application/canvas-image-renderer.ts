import {
    ApplicationBasedRenderer,
} from 'src/renderer/renderer';

import {
    CanvasImageRendererValueType,
    CanvasImageRendererOptionsType,
} from './types';

import {
    OutputContextLike,
} from 'src/output-context/types';


export class CanvasImageRenderer extends ApplicationBasedRenderer<CanvasImageRendererValueType, CanvasImageRendererOptionsType> {
    static get type (){ return 'canvas-image'; }

    async _render(ocx: OutputContextLike, canvas_renderer: CanvasImageRendererValueType, options?: CanvasImageRendererOptionsType): Promise<Element> {
        if (typeof canvas_renderer !== 'function') {
            throw new Error('canvas_renderer must be a function');
        }

        options ??= {};

        if (typeof (options as any).tag !== 'undefined') {
            console.warn('overriding options.tag value', (options as any).tag);
        }
        if (typeof (options as any).attrs?.[OutputContextLike.attribute__data_source_media_type] !== 'undefined') {
            console.warn(`overriding options.attrs["${OutputContextLike.attribute__data_source_media_type}"] value`, (options as any).attrs[OutputContextLike.attribute__data_source_media_type]);
        }
        if (typeof (options as any).attrs?.['src'] !== 'undefined') {
            console.warn('overriding options.src value', (options as any).attrs.src);
        }

        const image_options = {
            ...options,
            tag: 'img',
            attrs: {
                ...((options as any).attrs ?? {}),
                [OutputContextLike.attribute__data_source_media_type]: this.media_type,
                // "src" set below
            },
        };

        // note: "width" and "height" attributes, if specified in options, will be
        // applied to both the canvas element and the img element.  This is ok because
        // these attributes represent size in px in both element types.

        const canvas = ocx.CLASS.create_element({
            tag: 'canvas',
            attrs: {
                ...((options as any).attrs ?? {}),
                width:  (options as any).attrs?.width,
                height: (options as any).attrs?.height,
            },
            style: (options as any).style,
        }) as HTMLCanvasElement;
        await canvas_renderer(canvas);
        image_options.attrs.src = canvas.toDataURL();

        const image = ocx.create_child(image_options);
        return image;
    }
}
