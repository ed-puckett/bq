const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


export function open_help_window() {
    window.open(new URL('../../dist/help.html', assets_server_url(current_script_url)));
}
