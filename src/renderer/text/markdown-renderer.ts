import {
    _initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    RendererFactory,
    TextBasedRenderer,
} from 'src/renderer/renderer';

import {
    TextBasedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    ErrorRenderer,
} from 'src/renderer/application/error-renderer';

import {
    TeXRenderer,
} from 'src/renderer/text/tex-renderer';

import {
    JavaScriptRenderer,
} from 'src/renderer/text/javascript-renderer/_';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    marked,
} from './marked';

import {
    generate_object_id,
} from 'lib/sys/uuid';


// TeX handling adapted from: marked-katex-extension/index.js
// https://github.com/UziTech/marked-katex-extension/blob/main/src/index.js
// See also: https://marked.js.org/using_pro#async


// ``` blocks are extended as follows:
// - the opening ``` may be optionally followed by:
//   -- renderer source type (e.g., "javascript", the default)
//   -- then either $ or ! or both in either order:
//      --- $ indicates that the "source" should be output (in a block with css class: eval_code_source_css_class)
//      --- ! indicates that the source should be rendered (executed) and output
// - the source type, $ and ! can be separated by any amount of whitespace, or none

const extension_name__inline_tex = 'inline-tex';
const extension_name__block_tex  = 'block-tex';
const extension_name__eval_code  = 'eval-code';

const inline_tex_match_re = /^\$+([^$]+?)\$+/;

const block_tex_match_re = /^\$\$([^$]+?)\$\$/;

const eval_code_start_re = /^[`]{3}[\s]*[^!$\s\n]*[\s!$]*[\n]/;
const eval_code_match_re = /^[`]{3}[\s]*(?<source_type>[^!$\s\n]*)[\s]*((?<flags_exec>[!])|(?<flags_show_exec>[$][\s]*[!])|(?<flags_exec_show>[!][\s]*[$]))[\s]*[\n](?<code>.*?)[`]{3}/s;
const eval_code_source_type_default = JavaScriptRenderer.type;
const eval_code_source_css_class = 'markdown-code-source';


type walkTokens_token_type = {
    type?:         string,
    raw?:          string,
    text?:         string,
    markup?:       string,
    source_type?:  string,
    show?:         boolean,
    global_state?: object,  // used only by extension_name__inline_tex and extension_name__block_tex
};

export class MarkdownRenderer extends TextBasedRenderer {
    static get type (){ return 'markdown'; }

    static {
        // required for all TextBasedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    /** Render by evaluating the given markdown and outputting to ocx.
     * @param {OutputContextLike} ocx,
     * @param {String} markdown,
     * @param {TextBasedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, markdown: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        markdown ??= '';

        const {
            style,
            inline,
            global_state = ocx.bq.global_state,
        } = (options ?? {});

        const parent = ocx.create_child({
            tag: inline ? 'span' : 'div',
            attrs: {
                [OutputContextLike.attribute__data_source_media_type]: this.media_type,
            },
            style,
        });

        let deferred_evaluations: {
            output_element_id: string,
            text:              string,
            renderer:          TextBasedRenderer,
            renderer_options:  TextBasedRendererOptionsType,
        }[] = [];

        const marked_options = {
            walkTokens(token: walkTokens_token_type) {
                switch (token.type) {
                    case extension_name__inline_tex:
                    case extension_name__block_tex: {
                        token.global_state = global_state;
                        break;
                    }

                    case extension_name__eval_code: {
                        let renderer_factory: undefined|RendererFactory = undefined;
                        try {

                            const {
                                text = '',
                                source_type,
                                show = false,
                            } = token;
                            if (!source_type) {
                                throw new Error('no source_type given');
                            }
                            renderer_factory = TextBasedRenderer.factory_for_type(source_type);
                            if (!renderer_factory) {
                                throw new Error(`cannot find renderer for source type "${source_type}"`);
                            }
                            const markup_segments: string[] = [];
                            function add_segment(renderer_factory: RendererFactory, text_to_render: string, css_class?: string) {
                                const output_element_id = generate_object_id();
                                deferred_evaluations.push({
                                    output_element_id,
                                    text: text_to_render,
                                    renderer: new renderer_factory() as TextBasedRenderer,
                                    renderer_options: {
                                        global_state,
                                    },
                                });
                                // this is the element we will render to from deferred_evaluations:
                                markup_segments.push(`<div id="${output_element_id}"${css_class ? ` class="${css_class}"` : ''}></div>`);
                            }
                            if (show && text) {
                                // render the source text without executing
                                add_segment(MarkdownRenderer, '```'+source_type+'\n'+text+'\n```\n', eval_code_source_css_class);
                            }
                            // render/execute the source text
                            add_segment(renderer_factory, text);
                            token.markup = markup_segments.join('\n');

                        } catch (error: unknown) {
                            const error_ocx = ocx.create_new_ocx(document.createElement('div'));  // temporary, for renderering error
                            ErrorRenderer.render_sync(error_ocx, error);
                            token.markup = error_ocx.element.innerHTML;
                        }
                        break;
                    }
                }
            }
        };

        const markup = marked.parse(markdown, marked_options);  // using extensions, see below
        parent.innerHTML = markup;

        // now run the deferred_evaluations
        // by setting up the output elements for each of deferred_evaluations, we
        // are now free to render asynchronously and in the background
        // Note: we are assuming that parent (and ocx.element) are already in the DOM
        // so that we can find the output element through document.getElementById().
        for (const { output_element_id, text, renderer, renderer_options } of deferred_evaluations) {
            const output_element = document.getElementById(output_element_id);
            if (!output_element) {
                // unexpected...
                ErrorRenderer.render_sync(ocx, new Error(`deferred_evaluations: cannot find output element with id "${output_element_id}"`));
            } else {
                const sub_ocx = ocx.create_new_ocx(output_element, ocx);
                await renderer.render(sub_ocx, text, renderer_options)
                    .catch((error: unknown) => {
                        sub_ocx.keepalive = false;  // in case this got set prior to the error
                        ErrorRenderer.render_sync(sub_ocx, error);
                    });
                if (!sub_ocx.keepalive) {
                    sub_ocx.stop();  // stop background processing, if any
                }
            }
        }

        return parent;
    }
}

marked.use({
    extensions: [
        {
            name: extension_name__inline_tex,
            level: 'inline',
            start(src: string) { return src.indexOf('$'); },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(inline_tex_match_re);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__inline_tex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return TeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  false,
                    throwOnError: false,
                });
            },
        },
        {
            name: extension_name__block_tex,
            level: 'block',
            start(src: string) { return src.indexOf('$$'); },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(block_tex_match_re);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__block_tex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                const markup = TeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  true,
                    throwOnError: false,
                });
                return `<p>${markup}</p>`;
            },
        },
        {
            name: extension_name__eval_code,
            level: 'block',
            start(src: string) { return src.match(eval_code_start_re)?.index; },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(eval_code_match_re);
                if (!match) {
                    return undefined;
                } else {
                    const source_type = (match.groups?.source_type?.trim() ?? '') || eval_code_source_type_default;
                    const code = match.groups?.code ?? '';
                    const show = !!(match.groups?.flags_show_exec || match.groups?.flags_exec_show);

                    return {
                        type: extension_name__eval_code,
                        raw: match[0],
                        text: code,
                        source_type,
                        show,
                        markup: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return token.markup;  // now already filled in by walkTokens
            },
        },
    ],
});
