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
    LaTeXRenderer,
} from 'src/renderer/text/latex-renderer';

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


// LaTeX handling adapted from: marked-katex-extension/index.js
// https://github.com/UziTech/marked-katex-extension/blob/main/src/index.js
// See also: https://marked.js.org/using_pro#async


// ``` blocks are extended as follows:
// - the opening ``` may be optionally followed by:
//   -- renderer source type (e.g., "javascript", the default)
//   -- then either $ or ! or both in either order:
//      --- $ indicates that the "source" should be output (in a block with css class: eval_code_source_css_class)
//      --- ! indicates that the source should be rendered (executed) and output
// - the source type, $ and ! can be separated by any amount of whitespace, or none

const extension_name__inline_latex     = 'inline-latex';
const extension_name__block_latex      = 'block-latex';
const extension_name__inline_eval_code = 'inline-eval-code';
const extension_name__eval_code        = 'eval-code';

const inline_latex_start_re = /\$[^$!]/;
const block_latex_start_re  = /\$\$/;

const inline_latex_match_re = /^\$((?:\\.|[^\\$!])(?:\\.|[^\\$])*?)\$/;  // note: unlike block... below, do not match empty contents ($$)
const block_latex_match_re  = /^\$\$((?:\\.|\$[^$]|[^\\$])*?)\$\$/;

const inline_eval_code_start_re = /\$[!]/;
const inline_eval_code_match_re = /^\$[!]((?:\\.|[^\\$])+?)\$/;

// code block beginnings:
//     ```[\s]*[<flags>][\s]*[<language>]
//     ~~~[\s]*[<flags>][\s]*[<language>]
//
// [<language>]: optional language/renderer (default: javascript)
// [<flags>] optional flags:
//     (none)  // display normally according to markdown
//     !       // execute code block and render output
//     !$      // display code block and then execute and render output
//     $       // optional abbreviated version of !$
function make_eval_code_start_re(introducer_char: string) {
    return new RegExp(String.raw`[${introducer_char}]{3}[\s!$]*[\s]*[^!$\n]*[\n]`);
}
function make_eval_code_match_re(introducer_char: string) {
    return new RegExp(String.raw`^[${introducer_char}]{3}(?<flags_exec>[\s]*[!])?(?<flags_show>[\s]*[$])?[^\n]*?(?:[\n]|(?<source_type>[^\s\n]+)[^\n]*[\n])(?<code>.*?)[${introducer_char}]{3}`, 's');
}

const eval_code_start_re_tilde     = make_eval_code_start_re('~');
const eval_code_start_re_backquote = make_eval_code_start_re('`');

const eval_code_match_re_tilde     = make_eval_code_match_re('~');
const eval_code_match_re_backquote = make_eval_code_match_re('`');

const eval_code_source_type_default = JavaScriptRenderer.type;
const eval_code_source_css_class = 'bq-markdown-code-source';


type walkTokens_token_type = {
    type?:         string,
    raw?:          string,
    text?:         string,
    markup?:       string,
    inline?:       boolean,
    source_type?:  string,
    show?:         boolean,
    global_state?: object,  // used only by extension_name__inline_latex and extension_name__block_latex (for macros)
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
     * @param {undefined|TextBasedRendererOptionsType} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, markdown: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        markdown ??= '';

        const global_state = options?.global_state ?? ocx.bq.global_state;

        const parent = ocx.CLASS.element_for_options(ocx.element, options, true);
        parent.setAttribute(OutputContextLike.attribute__data_source_media_type, this.media_type);

        let deferred_evaluations: {
            output_element_id: string,
            text:              string,
            renderer:          TextBasedRenderer,
            renderer_options:  TextBasedRendererOptionsType,
        }[] = [];

        const marked_options = {
            walkTokens(token: walkTokens_token_type) {
                switch (token.type) {
                    case extension_name__inline_latex:
                    case extension_name__block_latex: {
                        token.global_state = global_state;
                        break;
                    }

                    case extension_name__inline_eval_code:
                    case extension_name__eval_code: {
                        let renderer_factory: undefined|RendererFactory = undefined;
                        try {

                            const {
                                text = '',
                                inline,
                                source_type,
                                show = false,
                            } = token;
                            if (!source_type) {
                                throw new TypeError('no source_type given');
                            }
                            renderer_factory = TextBasedRenderer.factory_for_type(source_type);
                            if (!renderer_factory) {
                                throw new TypeError(`cannot find renderer for source type "${source_type}"`);
                            }
                            const markup_segments: string[] = [];
                            function add_segment(renderer_factory: RendererFactory, text_to_render: string, css_class?: string) {
                                const output_element_id = generate_object_id();
                                deferred_evaluations.push({
                                    output_element_id,
                                    text: text_to_render,
                                    renderer: new renderer_factory() as TextBasedRenderer,
                                    renderer_options: {
                                        inline,
                                        global_state,
                                    },
                                });
                                // this is the element we will render to from deferred_evaluations:
                                const markup_segment_tag_name = inline ? 'span' : 'div';
                                markup_segments.push(`<${markup_segment_tag_name} id="${output_element_id}"${css_class ? ` class="${css_class}"` : ''}></${markup_segment_tag_name}>`);
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
                        sub_ocx.stop();  // stop background processing, if any
                        throw error;
                    });
                if (!sub_ocx.keepalive) {
                    sub_ocx.stop();  // stop background processing, if any
                }
            }
        }

        return parent;
    }
}

// This following implementation of custom heading id is taken from
// https://github.com/markedjs/marked-custom-heading-id instead of
// including another npm package.  This is necessary because the
// current marked implementation uses the entire text of the heading
// plus the custom id as the element id (probably a bug).  The code
// is copied/adapted here instead of using the npm package because the
// code is pretty simple and is MIT licensed.
marked.use({
    useNewRenderer: true,
    renderer: {
        heading(options: object) {
            const { text, depth } = (options as any);
            const match_re = /(?: +|^)\{#([a-z][\w-]*)\}(?: +|$)/i;
            const match = text.match(match_re);
            if (!match) {
                // fallback to original heading renderer
                return false;
            } else {
                return `<h${depth} id="${match[1]}">${text.replace(match_re, '')}</h${depth}>\n`;
            }
        },
    },
});

marked.use({
    extensions: [
        {
            name: extension_name__inline_latex,
            level: 'inline',
            start(src: string) {
                // must make sure we're not matching a $ in an "eval code" block
                const eval_code_match = src.match(eval_code_start_re_tilde) || src.match(eval_code_start_re_backquote);
                const match = src.match(inline_latex_start_re);
                if (!eval_code_match) {
                    // "eval code" did not match
                    return match?.index;
                } else if (match) {
                    // both matched
                    // (shenanigans because typescript doesn't know match.index and eval_code_match.index are not undefined)
                    if ((match.index??0) < (eval_code_match.index??Infinity)) {
                        return match.index;  // matched sooner that "eval code"
                    } else {
                        return undefined;
                    }
                } else {
                    // no match
                    return undefined;
                }
            },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(inline_latex_match_re);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__inline_latex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return LaTeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  false,
                    throwOnError: false,
                });
            },
        },
        {
            name: extension_name__block_latex,
            level: 'block',
            start(src: string) {
                const match = src.match(block_latex_start_re);
                return match?.index;
            },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(block_latex_match_re);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__block_latex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                const markup = LaTeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  true,
                    throwOnError: false,
                });
                return `<p>${markup}</p>`;
            },
        },
        {
            name: extension_name__inline_eval_code,
            level: 'inline',
            start(src: string) {
                const match = src.match(inline_eval_code_start_re);
                return match?.index;
            },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(inline_eval_code_match_re);
                if (!match) {
                    return undefined;
                } else {
                    const inline = true;
                    const source_type = JavaScriptRenderer.type;
                    const code = match[1];
                    const show = false;

                    return {
                        type: extension_name__inline_eval_code,
                        raw: match[0],
                        text: code,
                        inline,
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
        {
            name: extension_name__eval_code,
            level: 'block',
            start(src: string) {
                const match = src.match(eval_code_start_re_tilde) || src.match(eval_code_start_re_backquote);
                return match?.index;
            },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(eval_code_match_re_tilde) || src.match(eval_code_match_re_backquote);
                if (!match) {
                    return undefined;
                } else {
                    if (!(match.groups?.flags_exec || match.groups?.flags_show)) {  // flags_show implies flags_exec
                        return undefined;  // renderer according to normal markdown
                    } else {
                        const inline = false;
                        const source_type = (match.groups?.source_type?.trim() ?? '') || eval_code_source_type_default;
                        const code = match.groups?.code ?? '';
                        const show = !!(match.groups?.flags_show);

                        return {
                            type: extension_name__eval_code,
                            raw: match[0],
                            text: code,
                            inline,
                            source_type,
                            show,
                            markup: undefined,  // filled in later by walkTokens
                        };
                    }
                }
            },
            renderer(token: walkTokens_token_type) {
                return token.markup;  // now already filled in by walkTokens
            },
        },
    ],
});
