const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


export function open_help_window() {
    // the build process puts these assets in the top of the dist/<version_dir> directory; load relative to the repository root:
    window.open(new URL(`../../help/help.html`, assets_server_url(current_script_url)));
}
