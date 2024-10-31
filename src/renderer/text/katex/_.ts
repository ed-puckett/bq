// @ts-ignore  // types not available for the imported module
import imported_katex from 'dist/katex-dist/katex.mjs';

import 'dist/katex-dist/katex.min.css';  // webpack implementation
import './style.css';  // webpack implementation

/* --- OLD DYNAMIC IMPORT WAY ---
// import {
//     assets_server_url,
// } from 'lib/sys/assets-server-url';
//
// import {
//     create_stylesheet_link,
// } from 'lib/ui/dom-tools';
export async function load_stylesheet() {
    // create_stylesheet_link(document.head, new URL('dist/katex/dist/katex.min.css', assets_server_url(current_script_url)));
    // create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));

    // @ts-ignore  // types not available for the imported module
    await import('dist/katex/dist/katex.min.css');  // webpack implementation

    // @ts-ignore  // types not available for the imported module
    await import('./style.css');  // webpack implementation
}
await load_stylesheet();  // load stylesheet now
*/

export const katex = imported_katex;
