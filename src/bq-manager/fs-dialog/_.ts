const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';

import {
    create_element,
} from 'lib/ui/dom-tools';

import {
    create_control_element,
    create_select_element,
} from 'lib/ui/controls-tools';

import {
    Dialog,
    AlertDialog,
} from 'lib/ui/dialog/_';

import {
    beep,
} from 'lib/ui/beep';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./fs-dialog.css', assets_server_url(current_script_url)));
}


export class FsDialog extends HTMLDialogElement {
    get CLASS (){ return this.constructor as typeof FsDialog; }

    static css_class = 'fs-dialog';

    constructor() {
        super();
        this.classList.add(this.CLASS.css_class);
    }
}
