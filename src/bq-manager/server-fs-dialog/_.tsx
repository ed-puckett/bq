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
    _jsx_create_element,
} from 'lib/ui/jsx-create-element';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}



type TABLE_FROM_DIR_INFO_OPTIONS = {
    caption?:      string,
    sort_col?:     number,  // 0-based, must be a non-negative integer
    selected_row?: number,  // 0-based, must be a non-negative integer
};

const SORT_PROP_RE = /^(?<prop>[\w]+)(?:(?<op>[\/%])(?<divisor>[-]?(?:[0-9]+|0b[0-1]+|0o[0-7]+|0x[0-9a-fA-F]+)))?$/;

// data- props:
//
//     data-sort-col ....... on thead_tr, 0-based number specifying current sort column
//
//     data-sort-prop ...... on thead_tr_th, specify property name in DirInfo
//                           with optional /{N} or %{N} suffix.  If the optional
//                           suffix is given, then sorting is performed numerically
//                           (instead of textually, the normal way), and the value
//                           used for sorting is the value divided/mod-ed by {N}.
//                           N may be a positive or negative integer.
//
//     data-sort-reverse ... on thead_tr_th, if this attribute not present or its
//                           value is an empty string then the sort direction is
//                           forward, otherwise the sort direction is reverse.


export class ServerFsDialog {
    get CLASS (){ return this.constructor as typeof ServerFsDialog; }

    static css_class = 'fs-dialog';

    async run(server_interface: ServerInterface, start_url: URL, for_save: boolean = false): Promise<undefined|string> {
        const dialog = this.#create_dialog();
        document.body.appendChild(dialog);//!!!
        const parent = dialog;//!!!
        const slash_index = start_url.pathname?.lastIndexOf('/');
        if (!slash_index || slash_index === -1) {
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
        parent.appendChild(this.#table_from_dir_info(dir_info, {
            caption: 'FILE LIST',
        }));
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
    #create_dialog(): HTMLDialogElement {
        const dialog = <dialog> </dialog>;
        return dialog as HTMLDialogElement;
    }

    /** create HTML table markup from the given dir_info
     */
    #table_from_dir_info(dir_info: DirInfo[], options: TABLE_FROM_DIR_INFO_OPTIONS={}): Element {
        const default_sort_col = 1;  // 0-based
        dir_info = [ ...dir_info ];  // copy so that sorting does not affect passed value
        const {
            caption,
        } = options;
        let {
            sort_col     = default_sort_col,  // 0-based
            selected_row = 0,                 // 0-based
        } = options;

        // sort_col is validated below
        if (!Number.isInteger(selected_row) || selected_row < 0) {
            throw new TypeError('selected_row must be a non-negative integer');
        }
        // selected_row will be clamped to the integer rangle [0, dir_info.length-1].

        const table =
            <table>
                <caption>
                    {caption ?? ''}
                </caption>
                <thead>
                    <tr data-sort-col={sort_col}>
                        <th scope="col" data-sort-prop="type">Type</th>
                        <th scope="col" data-sort-prop="mode">Access</th>
                        <th scope="col" data-sort-prop="name">Name</th>
                        <th scope="col" data-sort-prop="size/1">Size</th>
                        <th scope="col" data-sort-prop="modify_time_ms">Modified</th>
                        <td>{/* manipulation links */}</td>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>;

        // remove the caption element if no caption was specified
        if (!caption) {
            const caption_element = table.querySelector('table caption');
            if (caption_element) {  // this test is only to please typescript
                caption_element.remove();
            }
        }

        const thead_tr = table.querySelector('thead tr[data-sort-col]');
        const tbody    = table.querySelector('tbody');

        if (!thead_tr || !tbody) {
            throw new Error('unexpected: table elements not found');
        }

        const col_headers = Array.from(thead_tr.querySelectorAll('th[scope="col"][data-sort-prop]'));
        const col_count   = col_headers.length;

        const make_file_row = (di: DirInfo, selected: boolean): HTMLElement => {
            //!!!
            const row_markup =
                <tr>
                    <td>{/*type*/} {di.type}</td>
                    <td>{/*mode*/} {di.mode.toString()}</td>
                    <td>{/*name*/} {di.name}</td>
                    <td>{/*size*/} {di.size.toString()}</td>
                    <td>{/*time*/} {di.modify_time_ms.toString()}</td>
                    <td>{/*mods*/} !!!</td>
                </tr>;
            return row_markup;
        }

        const validate_sort_col = (throw_error_if_invalid=false) => {
            const complaint = (Number.isInteger(sort_col) && 0 <= sort_col && sort_col < col_count )
                ? undefined
                : `col_count must be in the integer range [0, ${col_count-1}]`;
            if (complaint && throw_error_if_invalid) {
                throw new TypeError(complaint);
            }
           return complaint;
        }

        const clamp_selected_row = () => {  // clamp selected_row to the range [0, dir_info.length-1] or 0 if dir_info is empty
            if (dir_info.length === 0) {
                selected_row = 0;
            } else if (selected_row < 0) {
                selected_row = 0;
            } else if (selected_row >= dir_info.length) {
                selected_row = dir_info.length-1;
            }
        }

        const make_sort_function = (): ((a: any, b: any) => number) => {
            const col = validate_sort_col() ? 0 : sort_col;
            const col_header = col_headers[sort_col];
            const sort_reverse: boolean = !!col_header.getAttribute('data-sort-reverse');
            const sort_prop  = col_header.getAttribute('data-sort-prop');
            if (!sort_prop) {
                throw new Error(`unexpected: could not find data-sort-prop attribute for column ${sort_col}`);
            }
            const match = sort_prop.match(SORT_PROP_RE);
            if (!match) {
                throw new Error(`illegal data-sort-prop value for header "${col_header.textContent?.trim()}"`);
            }
            const { prop, op, divisor } = match.groups as { [key: string]: string };
            
            if (!op) {
                // compare as strings
                return !sort_reverse
                    ? (a: any, b: any): number => (((a[prop] as any) === (b[prop] as any)) ? 0 : ((a[prop] as any) < (b[prop] as any)) ? -1 :  1)
                    : (a: any, b: any): number => (((a[prop] as any) === (b[prop] as any)) ? 0 : ((a[prop] as any) < (b[prop] as any)) ?  1 : -1);
            } else {
                // compare as numbers and divide or mod by divisor
                // note: SORT_PROP_RE guarantees that divisor is defined when op is defined
                const divisor_number = +divisor;
                if (Number.isNaN(divisor_number) || divisor_number === 0) {
                    throw new Error(`data-sort-prop with illegal divisor for header "${col_header.textContent?.trim()}"`);
                }
                const xf = (op === '/')
                    ? (di: any) => Math.trunc(di[prop] / divisor_number)
                    : (di: any) => di[prop] % divisor_number // (op === '%')
                return !sort_reverse
                    ? (a: any, b: any): number => (xf(a[prop]) - xf(b[prop]))
                    : (a: any, b: any): number => (xf(b[prop]) - xf(a[prop]));
            }
        }

        const render = () => {
            if (!tbody) {  // typescript can't figure out that this was already guaranteed above...
                throw new Error('unexpected: tbody not found');
            }
            clamp_selected_row();
            dir_info.sort(make_sort_function());
            clear_element(tbody);
            dir_info.forEach((di, index) => {
                tbody.appendChild(
                    make_file_row(di, (index === selected_row))
                );
            });
        }

        render();

        return table;
    }
}
(globalThis as any).ServerFsDialog = ServerFsDialog;//!!!
