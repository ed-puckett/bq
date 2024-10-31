const current_script_url = import.meta.url;  // save for later

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


declare global {
    var marked: any;
}

await load_script(document.head, new URL('../../../dist/marked.min.js', assets_server_url(current_script_url)));

export const marked = globalThis.marked;
