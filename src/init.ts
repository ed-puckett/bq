const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    make_string_literal,
} from 'lib/sys/string-tools';

import {
    BqManager,
} from 'src/bq-manager/_';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    reset_to_initial_text_renderer_factories,
} from 'src/renderer/factories';


// === BOOTSTRAP SCRIPT SRC DATA ===

const _bootstrap_script_src_alternative_descriptions = {  // these items may be either a description string or [ description, details ]
    original: [
        'Original' ,
        'Preserve the bootstrap script url as originally loaded.',
    ],
    relative: [
        'Relative',
        'Use a relative bootstrap script url.  This will make the saved notebook independent of any particular server but will work only if the saved notebook will be loaded from a server that contains the bootstrap code in the same relative location as the current server.',
    ],
    absolute: [
        'Absolute',
        'Use an absolute bootstrap script url from the current server.  This will make the saved notebook independent of its relative location, but will only work if the current server will be accessible when loading the saved notebook.',
    ],
    external: [
        'External',
        'Use an absolute external bootstrap script url.  This is a good choice when the saved notebook will be loaded from a server that is independent of the bootstrap script server.',
    ],
};
export const bootstrap_script_src_alternatives_default = 'original';

const _external_bootstrap_link = 'https://ed-puckett.github.io/bq/dist/bq-bootstrap.js';

// see also below: get_bootstrap_script_src_alternatives()


// === CELL-VIEW / AUTO-EVAL DATA ===

export const cell_view_attribute_name = 'data-cell-view';  // set on document.documentElement
export const auto_eval_attribute_name = 'data-auto-eval';  // set on document.documentElement; significance: only presence or absence

const _cell_view_descriptions = {
    normal:       'normal: show all cells, scrolling if necessary (the default)',
    none:         'none: hide all cells',
    hide:         'hide: cells auto-hide; show active cell, scrolling if necessary, and minimize all others',
    full:         'full: show all cells fully without scrolling',
    presentation: 'presentation mode: limit interaction and hide all cells (except those with class "show-in-presentation")',
};
const _valid_cell_view_values = Object.keys(_cell_view_descriptions);
export const cell_view_values_default = 'normal';
export function get_valid_cell_view_values() { return [ ..._valid_cell_view_values ]; }  // return copy to prevent modification
export function get_cell_view_descriptions() { return { ..._cell_view_descriptions }; }  // return copy to prevent modification

export function get_auto_eval() { return document.documentElement.hasAttribute(auto_eval_attribute_name); }
export function set_auto_eval(setting: boolean) {
    if (setting) {
        document.documentElement.setAttribute(auto_eval_attribute_name, '');
    } else {
        document.documentElement.removeAttribute(auto_eval_attribute_name);
    }
}


// === DOCUMENT INITIALIZATION ===

// this script is itself (part of or loaded by) the bootstrap script, so we can go ahead and grab its markup now...
const _basic_bootstrap_script_src_alternatives = _get_basic_bootstrap_script_src_alternatives();
if (!_basic_bootstrap_script_src_alternatives) {
    show_initialization_failed('unexpected: failed to find bootstrap script');
} else {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        initialize_document();
    } else {
        window.addEventListener('load', async (load_event: Event) => {
            initialize_document();
        }, {
            once: true,
        });
    }
}

async function initialize_document(): Promise<void> {
    window.addEventListener('error',              (event) => _show_unhandled_event(event, false));  // event listener never removed
    window.addEventListener('unhandledrejection', (event) => _show_unhandled_event(event, true));   // event listener never removed

    try {

        // validate html[data-cell-view]
        const cell_view = document.documentElement.getAttribute(cell_view_attribute_name);
        if (cell_view && !_valid_cell_view_values.includes(cell_view)) {
            throw new Error(`<html> attribute ${cell_view_attribute_name} must be unset or one of: "${_valid_cell_view_values.join('", "')}"`);
        }

        // establish head element if not already present
        if (!document.head) {
            const head_element = document.createElement('head');
            document.documentElement.insertBefore(head_element, document.documentElement.firstChild);
            // document.head is now set
        }

        // establish favicon if not already present
        if (!document.querySelector('link[rel="icon"]')) {
            const link_element = document.createElement('link');
            link_element.rel  = 'icon';
            link_element.href = new URL('../dist/favicon.ico', assets_server_url(current_script_url)).toString();
            document.head.appendChild(link_element);
        }

        // establish <meta name="viewport" content="width=device-width, initial-scale=1"> if not already present
        // this enables @media queries for responsiveness to size changes
        if (!document.querySelector('meta[name="viewport"]')) {
            const meta_viewport_element = document.createElement('meta');
            meta_viewport_element.name  = 'viewport';
            meta_viewport_element.content = 'width=device-width, initial-scale=1';
            document.head.appendChild(meta_viewport_element);
        }

        // establish body element if not already present
        if (!document.body) {
            document.documentElement.appendChild(document.createElement('body'));
            // document.body is now set
        }

        // create header element
        const header_element = document.createElement('header');

        // Ensure that all bq-cell elements have a unique id.
        // This is important because otherwise they collide on a single output element.
        const cell_ids = new Set();
        for (const cell of document.querySelectorAll('bq-cell')) {
            const id = cell.id;
            if (id) {
                if (cell_ids.has(id)) {
                    throw new Error(`bq-cell element has a repeated id "${id}"`);
                }
                cell_ids.add(id);
            }
        }

        // create the main element and move the current children of the body element into it
        const main_element = document.createElement('main');
        for (let child; !!(child = document.body.firstChild); ) {
            main_element.appendChild(child);  // child is moved to main_element
        }

        // add header and main elements to the (now empty) body
        document.body.appendChild(header_element);
        document.body.appendChild(main_element);

        // document restructuring complete

        // The document is now in the expected format.
        // Initialize BqManager to enable interaction.
        BqManager._initialize_singleton();

        // initialize renderer factories after all the TextBasedRenderer factories have been registered...
        reset_to_initial_text_renderer_factories();

        // asynchronously start BqManager instance
        setTimeout(() => BqManager.singleton.start());

    } catch (error: unknown) {
        show_initialization_failed(error);
    }

    (globalThis as any)._uninhibit_document_display?.();
}

function _show_unhandled_event(event: Event, is_unhandled_rejection: boolean): void {
    (globalThis as any)._uninhibit_document_display?.();
    const message = is_unhandled_rejection ? 'UNHANDLED REJECTION' : 'UNHANDLED ERROR';
    console.error(message, event);
    if (BqManager.ready) {
        BqManager.singleton._show_unhandled_event(event, is_unhandled_rejection);
    }
}

export function show_initialization_failed(reason: unknown) {
    (globalThis as any)._uninhibit_document_display?.();
    const error = (reason instanceof Error)
        ? reason
        : new Error((reason as any)?.toString?.() ?? 'INITIALIZATION ERROR');
    console.error('initialization failed', error.stack);
    document.body.innerText = '';  // clear all children
    const error_h1 = document.createElement('h1');
    error_h1.innerText = error.message ?? 'Initialization Failed';
    const error_pre = document.createElement('pre');
    error_pre.classList.add('error-message');
    error_pre.innerText = error.stack ?? 'INITIALIZATION ERROR';
    document.body.appendChild(error_h1);
    document.body.appendChild(error_pre);
}

/** Serializer for use by save, save-as and export operations
 * @param {undefined|string} bootstrap_script_src_choice, must be one of the keys
 *        from the object returned by _basic_bootstrap_script_src_alternatives
 * @param {Object}: options?: {
 *     cell_view?: string,  // the initial cell view option; if not undefined,
 *                          // must be one of _valid_cell_view_values.
 *                          // If undefined, then use current document's
 *                          // cell_view setting or don't specify cell_view
 *                          // at all if not set in document.
 *
 *     auto_eval?: boolean = false,  // set "auto-eval" on saved document?
 *
 *     active_cell?: boolean = false,  // whether or not to preserve the
 *                                     // "data-active" attribute on the
 *                                     // active cell.
 * }
 * @return {string} the HTML source string
 */
export async function save_serializer(
    bootstrap_script_src_choice?: string,
    options?: object
): Promise<string> {
    options ??= {};
    let {
        cell_view,
    } = (options as any);
    const {
        auto_eval   = false,
        active_cell = false,
    } = (options as any);

    if (typeof cell_view !== 'undefined' && !_valid_cell_view_values.includes(cell_view)) {
        throw new Error(`illegal cell_view value: ${cell_view}`);
    }
    let cell_view_from_document: null|string = document.documentElement.getAttribute(cell_view_attribute_name);
    if (cell_view_from_document && !_valid_cell_view_values.includes(cell_view_from_document)) {
        cell_view_from_document = null;  // don't propagate invalid value
    }
    if (typeof cell_view === 'undefined' && cell_view_from_document) {
        cell_view = cell_view_from_document;
    }

    const bootstrap_script_src = _get_bootstrap_script_src(bootstrap_script_src_choice);

    const main_element = document.querySelector('main');
    if (!main_element) {
        throw new Error('bad format for document: <main> element not found');
    }
    const contents_segments = [];
    for (const node of main_element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue !== null) {
            contents_segments.push(node.nodeValue);  // the text of the TEXT node
        } else if (node instanceof BqCellElement) {
            contents_segments.push(node.getOuterHTML(active_cell));
        } else if (node instanceof Element) {
            contents_segments.push(node.outerHTML);
        } else {
            console.warn('save_serializer(): ignoring not-text, non-Element node', node);
        }
    }
    // Note on newlines.  See:
    //     https://stackoverflow.com/questions/52457449/why-do-browsers-insert-2-linebreaks-into-an-empty-body-element
    //     https://html.spec.whatwg.org/#parsing-main-inhtml
    // Eliminate extra newlines at the beginning and end of <main>.
    // Note that the contents of <main> were the original contents of <body>
    // before being transformed by initialize_document() above.
    // The problem being addressed here is accumulation of newlines
    // at the end of the body section by repeated open/save cycles.
    const multiple_newline_re = /^[\n]{2,}$/;
    if (contents_segments.length > 1 && contents_segments[0].match(multiple_newline_re)) {
        contents_segments[0] = '\n';
    }
    if (contents_segments.length > 2 && contents_segments[contents_segments.length-1].match(multiple_newline_re)) {
        contents_segments[contents_segments.length-1] = '\n';
    }
    // Now get the final contents for the <body> to be saved
    const contents = contents_segments.join('');
    const title_element = document.querySelector('head title') as HTMLElement;
    const title_text    = title_element ? title_element.innerText.replaceAll('<', '&lt;') : '';
    const title_markup  = title_text ? `  <title>${title_text}</title>\n` : '';
    return `\
<!DOCTYPE html>
<html lang="en"${cell_view && (cell_view !== cell_view_values_default) ? ` ${cell_view_attribute_name}="${cell_view}"` : ''}${auto_eval ? ` ${auto_eval_attribute_name}` : ''}>
<head>
    <meta charset="utf-8">
    <script src=${make_string_literal(bootstrap_script_src, true)}></script>
${title_markup}</head>
<body>${contents}</body>
</html>
`;
}

/** Called during document initialization to get alternatives for the
 * bootstrap script src attribute.
 * @return {undefined|object} undefined if bootstrap script not found,
 *         otherwise a promise resolving to an object containing the alternatives.
 * If non-undefined i.e., an object is returned, then is possible that nothing
 * will be returned for "relative" if the origins on the "absolute" url and
 * document.location do not match.
 */
function _get_basic_bootstrap_script_src_alternatives(): undefined|object {
    const markup_segments: string[] = [];
    const bootstrap_script_element = document.querySelector('head script') as null|HTMLScriptElement;
    if (!bootstrap_script_element) {
        console.error('no script element in <head> section');
    } else {
        const original = bootstrap_script_element.getAttribute('src');
        if (!original || bootstrap_script_element.getAttributeNames().length !== 1) {
            console.error('bootstrap script must have only the single attribute "src"');
        } else {
            const absolute = bootstrap_script_element.src;  // returns absolute url as a string
            let relative: undefined|string = undefined;  // a path-relative reference, but not a relative reference with an absolute path
            // non_relative_path_re matches strings with prefix ":" or "<scheme>:" (for relative reference) or "/" (for relative-path reference)
            const non_relative_path_re = /^((([A-Za-z][A-Za-z0-9+-.]*)?[:])|([/]))/;
            if (!original.match(non_relative_path_re)) {
                // original is already a relative-path reference
                relative = original;
            } else {
                // Try to form a relative reference with respect to document.location.
                // This will only work if absolute and document.location have the same origins.
                const abs_url = new URL(absolute);
                if (abs_url.origin === document.location.origin) {
                    const abs_path_segments = abs_url.pathname.split('/');
                    const loc_path_segments = document.location.pathname.split('/');
                    // Each segments array contains path segments, with the
                    // (possibly empty string) last segment representing the
                    // "filename" and prior segments representing "directories".
                    // Note that the first entry of each segments array will be
                    // an empty string because the pathname in both URL and Location
                    // are absolute paths.
                    // Now, find the point at which abs_path_segments and
                    // loc_path_segments diverge.
                    let i_diverge;
                    const limit = Math.min(abs_path_segments.length, loc_path_segments.length) - 1;  // -1 because last segment is "filename"
                    for (i_diverge = 0; i_diverge < limit; i_diverge++) {
                        if (abs_path_segments[i_diverge] !== loc_path_segments[i_diverge]) {
                            break;
                        }
                    }
                    const rel_path_segments = [];
                    // dotdot_count is the count of .. segments required to get up to the common path segment ancenstor
                    const dotdot_count = loc_path_segments.length - 1 - i_diverge;
                    for (let i = 0; i < dotdot_count; i++) {
                        rel_path_segments.push('..');
                    }
                    for (let i = i_diverge; i < abs_path_segments.length; i++) {
                        rel_path_segments.push(abs_path_segments[i]);
                    }
                    relative = rel_path_segments.join('/') + abs_url.search + abs_url.hash;
                }
            }
            let external: string = _external_bootstrap_link;
            const results = { original, relative, absolute, external };
            // preserve ordering from _bootstrap_script_src_alternative_descriptions
            return Object.fromEntries(
                Object.keys(_bootstrap_script_src_alternative_descriptions)
                    .filter(key => !!(results as any)[key])
                    .map(key => {
                        return [
                            key,
                            (results as any)[key],
                        ];
                    })
            );
        }
    }
    // if we get here, then the bootstrap script was not found
    return undefined;  // indicate: bootstrap script not found
}

function _get_bootstrap_script_src(bootstrap_script_src_choice?: string): string {
    if (!_basic_bootstrap_script_src_alternatives) {
        // this should never happen because the loading is aborted if !_basic_bootstrap_script_src_alternatives
        throw new Error('unexpected: !_basic_bootstrap_script_src_alternatives');
    }
    bootstrap_script_src_choice ??= bootstrap_script_src_alternatives_default;
    const src_alternatives = _basic_bootstrap_script_src_alternatives;
    const src = (src_alternatives as any)[bootstrap_script_src_choice];
    if (!src) {
        throw new Error(`invalid bootstrap_script_src_choice: ${bootstrap_script_src_choice}`);
    }
    return src;
}

export function get_bootstrap_script_src_alternatives(): { [choice: string]: { url: string, label: string, details: string } } {
    if (!_basic_bootstrap_script_src_alternatives) {
        // this should never happen because the loading is aborted if !_basic_bootstrap_script_src_alternatives
        throw new Error('unexpected: !_basic_bootstrap_script_src_alternatives');
    }
    const src_alternatives = { ..._basic_bootstrap_script_src_alternatives };  // copy to protect internal structure from modification
    for (const key in src_alternatives) {
        if (!(key in _bootstrap_script_src_alternative_descriptions)) {
            throw new Error(`unexpected: key in src_alternatives has no corresponding description: ${key}`);
        }
        let label, details;
        const label_and_details = (_bootstrap_script_src_alternative_descriptions as any)[key];
        if ( !(typeof label_and_details === 'string') &&
             !(Array.isArray(label_and_details) && label_and_details.length === 2 && label_and_details.every(it => typeof it === 'string')) ) {
            throw new Error(`unexpected: _bootstrap_script_src_alternative_descriptions["${key}"] must be a string or a two-element array of strings`);
        }
        if (typeof label_and_details === 'string') {
            label = label_and_details;
        } else {
            ([ label, details ] = label_and_details);
        }
        (src_alternatives as any)[key] = {
            url: (src_alternatives as any)[key],
            label,
            details,
        };
    }
    return src_alternatives;
}
