import {
    TextBasedRenderer,
} from 'src/renderer/renderer';

import {
    _initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    TextBasedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    OutputContext,
} from 'src/output-context';


export class TextRenderer extends TextBasedRenderer {
    static get type (){ return 'plain'; }

    static {
        // required for all TextBasedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    async _render(ocx: OutputContext, text: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        const element = ocx.CLASS.element_for_options(ocx.element, options, true) as HTMLElement;
        element.setAttribute(OutputContext.attribute__data_source_media_type, this.media_type);
        element.classList.add('bq-plain-text');
        element.innerText = text;  // innerText sanitizes text
        return element;
    }
}
