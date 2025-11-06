const current_script_url = import.meta.url;  // save for later

const local_server_root = new URL('../..', current_script_url);  // assumes this script is located two directory levels below server root

// This code assumes that the first script in the <head> section is the
// bootstrap script and that that script is in the "root" directory of
// the bq distribution.
const assets_server_script = document.querySelector('head script') as null|HTMLScriptElement;
let assets_server_root: undefined|URL = undefined;

function _setup_assets_server_root() {
    if (typeof assets_server_root === 'undefined') {
        // because this module is employed when loading resources, and the
        // fact that we may encounter an error here, this initialization
        // is deferred until the call to assets_server_url().  Otherwise,
        // the error is thrown out of webpack code and can't be caught....
        if (!assets_server_script || !assets_server_script.src) {
            throw new Error('no script for assets server found in document');
        }
        // the following assumes that the script that src points to is
        // at the same level as the server "root".  Note that the server
        // "root" here is not synonymous with "/", but instead is the
        // root of this distribution on the server.
        assets_server_root = new URL('.', assets_server_script.src);

        // We assume that assets_server_root and local_server_root URLs end in '/'.
        // This is important for testing that URL prefixes match and concatenation below.
        if (assets_server_root.href.slice(-1) !== '/') {
            throw new Error('unexpected: assets_server_root URL does not end with "/"');
        }
        if (local_server_root.href.slice(-1) !== '/') {
            throw new Error('unexpected: local_server_root URL does not end with "/"');
        }
    }
}

/** @return {URL} url resolved against the running server url
 */
export function assets_server_url(local_url: string|URL|Location): URL {
    _setup_assets_server_root();
    if (!assets_server_root) {  // this is for the sake of typescript
        throw new Error('unexpected: assets_server_root is not set');
    }

    if (typeof local_url === 'string') {
        local_url = new URL(local_url, local_server_root);
    }

    let result: URL;
    if (local_url.href.startsWith(local_server_root.href)) {
        const relative = local_url.href.slice(local_server_root.href.length);
        result = new URL(relative, assets_server_root.href);
    } else {
        // we have no basis to reinterpret local_url with respect to assets_server_root
        result = (local_url instanceof URL) ? local_url : new URL(local_url.href);
    }
    return result;
}

/** return true iff url references the assets server and not some other server.
*/
export function url_references_assets_server(url: URL|Location): boolean {
    _setup_assets_server_root();
    if (!assets_server_root) {  // this is for the sake of typescript
        throw new Error('unexpected: assets_server_root is not set');
    }

    // We assume that instances of URL return an empty string
    // for the port when the port is unspecified or is specified
    // but is the default for the protocol.  This assures
    // consistent comparison below.
    return (
        url.protocol === assets_server_root.protocol &&
        url.host     === assets_server_root.host     &&  // host includes port if specified and not default
        ((url instanceof Location) ? '' : url.username) === assets_server_root.username &&  // Location has no username property
        url.pathname.startsWith(assets_server_root.pathname)
    );
}
