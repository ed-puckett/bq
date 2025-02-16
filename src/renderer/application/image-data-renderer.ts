import {
    ApplicationBasedRenderer,
} from 'src/renderer/renderer';

import {
    ImageDataRendererValueType,
    ImageDataRendererOptionsType,
} from './types';

import {
    OutputContext,
} from 'src/output-context';


export class ImageDataRenderer extends ApplicationBasedRenderer<ImageDataRendererValueType, ImageDataRendererOptionsType> {
    static get type (){ return 'image-data'; }

    async _render(ocx: OutputContext, config: ImageDataRendererValueType, options?: ImageDataRendererOptionsType): Promise<Element> {
        const style = options?.style;

        const parent = ocx.create_child({
            attrs: {
                [OutputContext.attribute__data_source_media_type]: this.media_type,
            },
        });
        const canvas = ocx.CLASS.create_element({
            parent,
            tag: 'canvas',
            style,
        }) as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const iter_config = Array.isArray(config) ? config : [ config ];
            for (const { x = 0, y = 0, image_data } of iter_config) {
                ctx.putImageData(image_data, x, y);
            }
        }

        return parent;
    }
}
