const current_script_url = import.meta.url;  // save for later

// @ts-ignore  // types not available for the imported module
import { version_dir } from 'dist/version-dir';

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
        await load_script(document.head, new URL(`../../../dist/${version_dir}/plotly.js`, assets_server_url(current_script_url)));  // defines globalThis.Plotly
        Plotly = globalThis.Plotly;
    }
    return Plotly;
}
