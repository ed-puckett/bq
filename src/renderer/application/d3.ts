const current_script_url = import.meta.url;  // save for later

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


let d3: any = undefined;

declare global {
    var d3: any;
}

export async function load_d3() {
    if (!d3) {
        await load_script(document.head, new URL('../../../dist/d3.min.js', assets_server_url(current_script_url)));  // defines globalThis.d3
        d3 = globalThis.d3;
    }
    return d3;
}
