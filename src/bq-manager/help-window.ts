const current_script_url = import.meta.url;  // save for later

// @ts-ignore  // types not available for the imported module
import { version_dir } from 'dist/version-dir';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


export function open_help_window() {
    window.open(new URL(`../../dist/${version_dir}/help.html`, assets_server_url(current_script_url)));
}
