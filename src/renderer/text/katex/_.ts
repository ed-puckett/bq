// @ts-ignore  // types not available for the imported module
import imported_katex from 'dist/katex-dist/katex.mjs';  // (resolved by webpack using "dist" module alias)

import 'dist/katex-dist/katex.min.css';  // webpack implementation (using "dist" module alias)
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
    // the build process puts these assets in the top of the dist/<version_dir> directory; load relative to the repository root:
    // create_stylesheet_link(document.head, new URL(`../../../../katex/dist/katex.min.css`, assets_server_url(current_script_url)));
    // create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));

    // the build process puts these assets in the top of the dist/<version_dir> directory; load relative to the repository root:
    await import(`../../../../katex/dist/katex.min.css`);  // webpack implementation

    await import('./style.css');  // webpack implementation
}
await load_stylesheet();  // load stylesheet now
*/

export const katex = imported_katex;
