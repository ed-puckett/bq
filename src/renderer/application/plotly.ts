const current_script_url = import.meta.url;  // save for later

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


let Plotly: any = undefined;  // loaded on demand

declare global {
    var Plotly: any;
}

/** return the Plotly object which will be lazily loaded because Plotly is large
 */
export async function load_Plotly() {
    if (!Plotly) {
        // the build process puts these assets in the top of the dist/<version_dir> directory; load relative to the repository root:
        await load_script(document.head, new URL(`../../../plotly.js`, assets_server_url(current_script_url)));  // defines globalThis.Plotly
        Plotly = globalThis.Plotly;
    }
    return Plotly;
}
