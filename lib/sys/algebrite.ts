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
        // the build process puts these assets in the top of the dist/<version_dir> directory; load relative to the repository root:
        await load_script(document.head, new URL(`../../algebrite.bundle-for-browser.js`, assets_server_url(current_script_url)));
        script_loaded = true;
    }
    return globalThis.Algebrite;
}
