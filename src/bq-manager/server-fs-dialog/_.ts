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


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}



type TABLE_FROM_DIR_INFO_OPTIONS = {
    parent?:  Element,
    caption?: string,
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
        const {
            parent,
            caption,
        } = options;

        return create_element({
            tag: 'table',
            parent,
            children: {
            },
        });
    }
}
