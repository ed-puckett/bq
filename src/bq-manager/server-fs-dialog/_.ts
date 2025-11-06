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
} from '../server-interface/_';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}


export class ServerFsDialog extends HTMLDialogElement {
    get CLASS (){ return this.constructor as typeof ServerFsDialog; }

    static css_class = 'fs-dialog';

    constructor(server_interface: ServerInterface) {
        super();
        this.classList.add(this.CLASS.css_class);
        //!!! populate !!!
    }

    // disable dangerous setter that may open the dialog in a bad way
    set open (_: any){ throw new Error('setter for "open" disabled'); }
}
