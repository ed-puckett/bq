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

        function make_sort_function(): ((a: any, b: any) => boolean) {
            const col = validate_sort_col() ? 0 : sort_col;
            const sort_prop = col_headers[sort_col].getAttribute('data-sort-prop');
            if (!sort_prop) {
                throw new Error(`unexpected: could not find data-sort-prop attribute for column ${sort_col}`);
            }
            return (a: any, b: any) => {
                return false;//!!!
            };
        }

        function add_file_row() {
            //!!!
        }

        //...

        return table;
    }
}
