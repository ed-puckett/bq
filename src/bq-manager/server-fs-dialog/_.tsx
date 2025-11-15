const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
    create_element,
} from 'lib/ui/dom-tools';

import {
    ServerInterface,
    DirInfo,
    is_DirInfo,
} from '../server-interface/_';

import {
    _jsx_create_element,
} from 'lib/ui/jsx-create-element';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}



type TABLE_FROM_DIR_INFO_OPTIONS = {
    caption?:      string,
    sort_col?:     number,  // 0-based, must be a postive integer
    selected_row?: number,  // 0-based, must be a postive integer
};

const SORT_PROP_RE = /^(?<prop>[\w]+)(?:(?<op>[\/%])(?<divisor>[0-9]+|0b[0-1]+|0o[0-7]+|0x[0-9a-fA-F]+))?$/;


export class ServerFsDialog extends HTMLDialogElement {
    get CLASS (){ return this.constructor as typeof ServerFsDialog; }

    static css_class = 'fs-dialog';

    constructor(server_interface: ServerInterface, start_url: URL, for_save=false) {
        super();
        this.classList.add(this.CLASS.css_class);
        //!!! populate !!!
    }

    // disable dangerous setter that may open the dialog in a bad way
    set open (_: any){ throw new Error('setter for "open" disabled'); }

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
                        <th scope="col" data-sort-prop="mode/0xfff">Type</th>
                        <th scope="col" data-sort-prop="name">Name</th>
                        <th scope="col" data-sort-prop="size">Size</th>
                        <th scope="col" data-sort-prop="mode%0xfff">Access</th>
                        <th scope="col" data-sort-prop="mtimeMs">Modified</th>
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

        const col_headers = Array.from(thead_tr.querySelectorAll('tr[data-sort-col] th[scope="col"][data-sort-prop] th'));
        const col_count   = col_headers.length;

        function validate_sort_col(throw_error_if_invalid=false) {
            const complaint = (Number.isInteger(sort_col) && 0 <= sort_col && sort_col < col_count )
                ? undefined
                : `col_count must be in the integer range [0, ${col_count-1}]`;
            if (complaint && throw_error_if_invalid) {
                throw new TypeError(complaint);
            }
           return complaint;
        }

        function clamp_selected_row() {  // clamp selected_row to the range [0, dir_info.length-1] or 0 if dir_info is empty
            if (dir_info.length === 0) {
                selected_row = 0;
            } else if (selected_row < 0) {
                selected_row = 0;
            } else if (selected_row >= dir_info.length) {
                selected_row = dir_info.length-1;
            }
        }

        function make_sort_function(): ((a: any, b: any) => number) {
            const col = validate_sort_col() ? 0 : sort_col;
            const col_header = col_headers[sort_col];
            const sort_prop  = col_header.getAttribute('data-sort-prop');
            if (!sort_prop) {
                throw new Error(`unexpected: could not find data-sort-prop attribute for column ${sort_col}`);
            }
            const match = sort_prop.match(SORT_PROP_RE);
            if (!match) {
                throw new Error(`illegal data-sort-prop value for header "${col_header.textContent?.trim()}"`);
            }
            const { prop, op, divisor } = (match as any);
            if (!op) {
                // compare as strings
                return (a: any, b: any): number => (((a as string) === (b as string)) ? 0 : ((a as string) < (b as string)) ? -1 : 1);
            } else {
                // compare as numbers and divide or mod by divisor
                // note: SORT_PROP_RE guarantees that divisor is defined when op is defined
                const divisor_number = +divisor;
                if (Number.isNaN(divisor_number) || divisor_number === 0) {
                    throw new Error(`data-sort-prop with illegal divisor for header "${col_header.textContent?.trim()}"`);
                }
                const xf = (op === '/')
                    ? (x: any) => Math.trunc((x as number) / divisor_number)
                    : (x: any) => (x as number) % divisor_number // (op === '%')
                return (a: any, b: any): number => (xf(a) - xf(b));
            }
        }

        function add_file_row() {
            //!!!
        }

        //...

        return table;
    }
}
