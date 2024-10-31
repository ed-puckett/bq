const current_script_url = import.meta.url;  // save for later

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


declare global {
    var Algebrite: any;
}

let script_loaded = false;

export async function load_Algebrite() {
    if (!script_loaded) {
        await load_script(document.head, new URL('../../dist/algebrite.bundle-for-browser.js', assets_server_url(current_script_url)));
        script_loaded = true;
    }
    return globalThis.Algebrite;
}
