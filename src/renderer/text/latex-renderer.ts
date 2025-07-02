import {
    TextBasedRenderer,
    _initial_text_renderer_factories,
} from 'src/renderer/renderer';

import {
    TextBasedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    OutputContext,
} from 'src/output-context';

import {
    get_settings,
} from 'src/settings/_';

import {
    katex,
} from './katex/_';


export class LaTeXRenderer extends TextBasedRenderer {
    get CLASS () { return this.constructor as typeof LaTeXRenderer; }

    static get type (){ return 'latex'; }

    // the following is necessary for the initial TextBasedRenderer extensions:
    static { _initial_text_renderer_factories.push(this); }

    /** Render the given LaTeX source to ocx.
     * @param {OutputContext} ocx,
     * @param {String} latex,
     * @param {undefined|TextBasedRendererOptionsType} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContext, latex: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        latex ??= '';

        const global_state = options?.global_state ?? ocx.bq.global_state;

        const markup = this.CLASS.render_to_string(latex, global_state, {
            displayMode:  !options?.inline,
            throwOnError: false,
        });

        const element = ocx.CLASS.element_for_options(ocx.element, options, true);
        element.setAttribute(OutputContext.attribute__data_source_media_type, this.media_type);
        element.innerHTML = markup;

        return element;
    }

    static render_to_string(latex: string, global_state: any, katex_options?: object): string {
        latex ??= '';

        const {
            flush_left,
        } = (get_settings() as any).formatting_options as any;

//!!! fix usage of katex_options
        // this function encapsulates how the "macros" options is gotten from global_state
        katex_options = {
            macros: (global_state[this.type] ??= {}),
            fleqn: flush_left,
            ...(katex_options ?? {}),
        };
        (katex_options as any).macros ??= (global_state[this.type] ??= {});  // for persistent \gdef macros
        return katex.renderToString(latex, katex_options);
    }
}
