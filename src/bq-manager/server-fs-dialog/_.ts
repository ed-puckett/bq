const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    ServerInterface,
} from '../server-interface/_';

import {
    create_stylesheet_link,
    create_element,
} from 'lib/ui/dom-tools';

import {
    create_control_element,
    create_select_element,
} from 'lib/ui/controls-tools';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}


export class ServerFsDialog extends HTMLDialogElement {
    get CLASS (){ return this.constructor as typeof ServerFsDialog; }

    static css_class = 'fs-dialog';

    constructor(server_interface: ServerInterface) {
        super();
        this.classList.add(this.CLASS.css_class);
        this.#server_interface = server_interface;
    }
    #server_interface;
}
