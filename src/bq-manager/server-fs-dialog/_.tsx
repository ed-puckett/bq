const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
    clear_element,
} from 'lib/ui/dom-tools';

import {
    ServerInterface,
    DirInfo,
    is_DirInfo,
} from '../server-interface';

import {
    format_size,
    format_time,
} from 'lib/sys/formatters';

import {
    _jsx_create_element,
} from 'lib/ui/jsx-create-element';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}



type FILE_LIST_FROM_DIR_INFO_OPTIONS = {
    sort_col?:     number,  // 0-based, must be a non-negative integer
    selected_row?: number,  // 0-based, must be a non-negative integer
};

const SORT_PROP_RE = /^(?<prop>[\w]+)(?:(?<op>[\/%])(?<divisor>[-]?(?:[0-9]+|0b[0-1]+|0o[0-7]+|0x[0-9a-fA-F]+)))?$/;

// data- props:
//
//     data-sort-prop ...... on individual file list header elements, specify a
//                           property name in DirInfo with optional /{N} or
//                           %{N} suffix.  If the optional suffix is given,
//                           then sorting is performed numerically (instead
//                           of textually, the normal way), and the value used
//                           for sorting is the value divided/mod-ed by {N}.
//                           N may be a positive or negative integer.
//
//     data-sort-reverse ... on individual file list header elements, if this
//                           attribute is not present or its value is an empty
//                           string then the sort direction is forward, otherwise
//                           the sort direction is reverse.
//
//     data-numeric ........ on individual data elements in a file row in the
//                           file list content container, if present and set,
//                           then the data element's contents should be formatted
//                           as a number, otherwise it should be formatted as text.


export class ServerFsDialog {
    get CLASS (){ return this.constructor as typeof ServerFsDialog; }

    static dialog_css_class                      = 'server-fs-dialog';
    static directory_chooser_css_class           = 'server-fs-dialog-directory-chooser';
    static file_list_holder_css_class            = 'server-fs-dialog-file-list-holder';
    static file_list_css_class                   = 'server-fs-dialog-file-list';
    static file_list_header_container_css_class  = 'server-fs-dialog-file-list-header-container';
    static file_list_header_css_class            = 'server-fs-dialog-file-list-header';
    static file_list_content_container_css_class = 'server-fs-dialog-file-list-content-container';
    static file_list_controls_footer_css_class   = 'server-fs-dialog-file-list-controls-footer';

    async run(server_interface: ServerInterface, start_url: URL, for_save: boolean = false): Promise<undefined|string> {
        const dialog = this.#create_dialog(start_url);
        document.body.appendChild(dialog);
        const files_container = dialog.querySelector(`.${this.CLASS.file_list_holder_css_class}`);
        if (!files_container) {
            throw new Error('unexpected: could not find file list container element');
        }
        const slash_index = start_url.pathname?.lastIndexOf('/');
        if (slash_index === -1) {
            throw new TypeError('start_url pathname does not contain "/"');  // should never happen
        }
        const dir_url = new URL(start_url.pathname.slice(0, slash_index+1), start_url);  // grab the containing directory including the trailing "/"
        const res = await fetch(dir_url);
        const res_json = await res.text();
        const raw_dir_info = JSON.parse(res_json);
        if (!res.body) {
            console.error('unable to read directory for start_url', { start_url, dir_url, res });
            throw new Error('unable to read directory for start_url');
        }
        if (!Array.isArray(raw_dir_info) || !raw_dir_info.every(test => is_DirInfo(test))) {
            console.error('bad response when reading directory', { raw_dir_info });
            throw new Error('bad response when reading directory');
        }
        const dir_info: DirInfo[] = raw_dir_info;
        files_container.appendChild(this.#file_list_from_dir_info(dir_info));
        const {
            promise,
            resolve,
            reject,
        } = Promise.withResolvers();
        const cleanup = () => {
            dialog.remove();
        };
        dialog.oncancel = () => { cleanup(); resolve(undefined); }
        dialog.onclose  = () => { cleanup(); resolve('XYZZY!!!'); }
        dialog.showModal();
        return promise as Promise<undefined|string>;
    }

    /** create the HTMLServerDialog object by instantiating it from HTML
     */
    #create_dialog(start_url: URL): HTMLDialogElement {
        const dialog =
            <dialog class={this.CLASS.dialog_css_class}>
                <ol class={this.CLASS.directory_chooser_css_class}>
                </ol>
                <form>
                    <div class={this.CLASS.file_list_holder_css_class}> </div>
                    <div class={this.CLASS.file_list_controls_footer_css_class}>
                        <input type="cancel" name="cancel" />
                        <input type="submit" name="submit" />
                    </div>
                </form>
            </dialog>;

        const directory_chooser = dialog.querySelector(`.${this.CLASS.directory_chooser_css_class}`);
        if (!directory_chooser) {
            throw new Error('unexpected: directory chooser element not found');
        }
        const subdirs = start_url.pathname.split('/');
        for (const subdir of subdirs.slice(1, -1)) {  // omit the last (it represents a file/non-directory or is empty)
            const subdir_element = directory_chooser.appendChild(<li>{subdir || '/'}</li>);
            directory_chooser.appendChild(subdir_element);
        }

        return dialog as HTMLDialogElement;
    }

    /** create HTML markup for a file list from the given dir_info
     */
    #file_list_from_dir_info(dir_info: DirInfo[], options: FILE_LIST_FROM_DIR_INFO_OPTIONS={}): Element {
        const default_sort_col = 0;  // 0-based
        dir_info = [ ...dir_info ];  // copy so that sorting does not affect passed value
        let {
            sort_col     = default_sort_col,  // 0-based
            selected_row = 0,                 // 0-based
        } = options;

        if (dir_info.length === 0) {
            throw new TypeError('dir_info must not be empty');
        }

        // sort_col is validated below
        if (!Number.isInteger(selected_row) || selected_row < 0) {
            throw new TypeError('selected_row must be a non-negative integer');
        }
        // selected_row will be clamped to the integer rangle [0, dir_info.length-1].

        const file_list =
            <div class={this.CLASS.file_list_css_class}>
                <div class={this.CLASS.file_list_header_container_css_class}>
                    <div class={this.CLASS.file_list_header_css_class} scope="col" tabindex="0" data-sort-prop="name">Name</div>
                    <div class={this.CLASS.file_list_header_css_class} scope="col" tabindex="0" data-sort-prop="size/1">Size</div>
                    <div class={this.CLASS.file_list_header_css_class} scope="col" tabindex="0" data-sort-prop="modify_time_ms">Modified</div>
                    <div>{/* manipulation links */}</div>
                </div>
                <div class={this.CLASS.file_list_content_container_css_class}>
                </div>
            </div>;

        const header_container  = file_list.querySelector(`.${this.CLASS.file_list_header_container_css_class}`);
        const content_container = file_list.querySelector(`.${this.CLASS.file_list_content_container_css_class}`);

        if (!header_container || !content_container) {
            throw new Error('unexpected: table elements not found');
        }

        const col_headers = Array.from(header_container.querySelectorAll(`.${this.CLASS.file_list_header_css_class}`)) as Array<HTMLElement>;
        const col_count   = col_headers.length;

        const get_col_info = (col_header: HTMLElement) => {
            const sort_reverse: boolean = access_sort_direction(col_header);
            const sort_prop = col_header.getAttribute('data-sort-prop');
            if (!sort_prop) {
                throw new Error(`unexpected: could not find data-sort-prop attribute for column ${sort_col}`);
            }
            const sort_match = sort_prop.match(SORT_PROP_RE);
            if (!sort_match) {
                throw new Error(`illegal data-sort-prop value for header "${col_header.textContent?.trim()}"`);
            }
            const { prop, op, divisor } = sort_match.groups as { [key: string]: string };
            const divisor_number = +divisor;
            if (op && (Number.isNaN(divisor_number) || divisor_number === 0)) {
                throw new Error(`data-sort-prop with illegal divisor for header "${col_header.textContent?.trim()}"`);
            }
            return {
                sort_reverse,
                sort_prop,
                sort_match,
                prop, op, divisor, divisor_number,
            };
        };

        const make_file_row = (di: DirInfo, selected: boolean): HTMLElement => {
            // Note that the formatting of each column is not determined by
            // the header's 'data-sort-prop'--that is used for sorting/styling
            // purposes.  The actual formatting of the entries' data is
            // implemented here.
            const row_markup =
                <div role="row" aria-selected={selected.toString()}>
                    <div>{/*name*/} {di.name}</div>
                    <div>{/*size*/} {format_size(di.size, true, true)}</div>
                    <div>{/*time*/} {format_time(new Date(di.modify_time_ms))}</div>
                    <div>{/*mods*/} !!!</div>
                </div>;
            col_headers.forEach((col_header: HTMLElement, col_index: number) => {
                // columns that specify an op (and therefore divisor) are considered numeric
                if (get_col_info(col_header).op) {
                    row_markup.children[col_index]?.setAttribute('data-numeric', 'numeric');
                }
            });
            return row_markup;
        }

        const access_sort_direction = (col_header: HTMLElement, toggle_first: boolean = false) => {
            const sort_reverse_attribute_name = 'data-sort-reverse';
            // "reverse" is considered false if the attribute value for
            // sort_reverse_attribute_name is either null (meaning not present)
            // or an empty string.  Otherwise, "reverse" is considered true.
            let value = !!col_header.getAttribute(sort_reverse_attribute_name);  // false if getAttribute returns null or an empty string
            if (toggle_first) {
                value = !value;
                col_header.setAttribute(sort_reverse_attribute_name, (value ? 'reverse' : ''));
            }
            return value;
        };

        const find_checked_header = (): HTMLElement => {
            const checked_header = header_container.querySelector('[aria-checked="true"]') as HTMLElement;
            if (!checked_header) {
                console.error('unable to find checked header');
                throw new Error('unable to find checked header');
            }
            return checked_header;
        };

        // set aria-checked and click handlers for the column headers
        col_headers.forEach((col_header: HTMLElement, col_index: number) => {
            col_header.setAttribute('aria-checked', (col_index === sort_col).toString());
            const handle_header_interaction = (event: Event) => {
                const clicked_header = col_header;
                if (clicked_header) {  // should always be true
                    const checked_header = find_checked_header();
                    if (clicked_header === checked_header) {
                        access_sort_direction(clicked_header, true);  // toggle
                    } else {
                        checked_header.setAttribute('aria-checked', 'false');
                        clicked_header.setAttribute('aria-checked', 'true');
                    }
                    render();
                }
                event.preventDefault();
                event.stopPropagation();
            };
            col_header.onclick = handle_header_interaction;
            col_header.onkeydown = (event: KeyboardEvent) => {
                const { key, shiftKey, ctrlKey, altKey, metaKey } = event;
                if ([ 'Enter', ' ' ].includes(key) && !shiftKey && !ctrlKey && !altKey && !metaKey) {
                    handle_header_interaction(event);
                }
            };
        });

        const validate_sort_col = (throw_error_if_invalid=false) => {
            const complaint = (Number.isInteger(sort_col) && 0 <= sort_col && sort_col < col_count )
                ? undefined
                : `col_count must be in the integer range [0, ${col_count-1}]`;
            if (complaint && throw_error_if_invalid) {
                throw new TypeError(complaint);
            }
           return complaint;
        }
        validate_sort_col(true);  // will throw error if sort_col is not valid

        const clamp_selected_row = () => {  // clamp selected_row to the range [0, dir_info.length-1] or 0 if dir_info is empty
            if (selected_row < 0) {
                selected_row = 0;
            } else if (selected_row >= dir_info.length) {
                selected_row = dir_info.length-1;  // dir_info has already been guaranteed not to be empty
            }
        }

        const make_sort_function = (): ((a: any, b: any) => number) => {
            const checked_header = find_checked_header();
            const {
                sort_reverse,
                sort_prop,
                sort_match,
                prop, op, divisor, divisor_number,
            } = get_col_info(checked_header);

            if (!op) {
                // compare as strings
                return !sort_reverse
                    ? (a: any, b: any): number => (((a[prop] as any) === (b[prop] as any)) ? 0 : ((a[prop] as any) < (b[prop] as any)) ? -1 :  1)
                    : (a: any, b: any): number => (((a[prop] as any) === (b[prop] as any)) ? 0 : ((a[prop] as any) < (b[prop] as any)) ?  1 : -1);
            } else {
                // compare as numbers and divide or mod by divisor
                // note: get_col_info() (via SORT_PROP_RE) guarantees that divisor is defined when op is defined
                // note: divisor_number was already validated (integer, not NaN, not 0) by get_col_info()
                const xf = (op === '/')
                    ? (di: any) => Math.trunc(di[prop] / divisor_number)
                    : (di: any) => di[prop] % divisor_number // (op === '%')
                return !sort_reverse
                    ? (a: any, b: any): number => (xf(a) - xf(b))
                    : (a: any, b: any): number => (xf(b) - xf(a));
            }
        }

        const render = () => {
            clamp_selected_row();
            dir_info.sort(make_sort_function());
            clear_element(content_container);
            dir_info.forEach((di, index) => {
                content_container.appendChild(
                    make_file_row(di, (index === selected_row))
                );
            });
        }

        render();  // initial render

        return file_list;
    }
}
(globalThis as any).ServerFsDialog = ServerFsDialog;//!!!
