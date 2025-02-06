const current_script_url = import.meta.url;  // save for later

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


// the build process puts these assets in the top of the dist/<version_dir> directory; load relative to the repository root:
await load_script(document.head, new URL(`../../sprintf.min.js`, assets_server_url(current_script_url)));

declare global {
    var sprintf: { (fmt: string, ...rest: any[]): string };
}

export const sprintf = globalThis.sprintf;
