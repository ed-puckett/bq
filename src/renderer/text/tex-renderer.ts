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
    OutputContextLike,
} from 'src/output-context/types';

import {
    get_settings,
} from 'src/settings/_';

import {
    katex,
} from './katex/_';


export class TeXRenderer extends TextBasedRenderer {
    get CLASS () { return this.constructor as typeof TeXRenderer; }

    static get type (){ return 'tex'; }

    static {
        // required for all TextBasedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    /** Render the given TeX source to ocx.
     * @param {OutputContextLike} ocx,
     * @param {String} tex,
     * @param {TextBasedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, tex: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        tex ??= '';

        const {
            style,
            inline,
            global_state = ocx.bq.global_state ?? {},
        } = (options ?? {});

        const markup = this.CLASS.render_to_string(tex, global_state, {
            displayMode:  !inline,
            throwOnError: false,
        });

        const parent = ocx.create_child({
            attrs: {
                [OutputContextLike.attribute__data_source_media_type]: this.media_type,
            },
            style,
        });
        parent.innerHTML = markup;

        return parent;
    }

    static render_to_string(tex: string, global_state: any, katex_options?: object): string {
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
        return katex.renderToString(tex, katex_options);
    }
}
