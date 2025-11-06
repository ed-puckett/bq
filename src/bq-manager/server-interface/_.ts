const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
    url_references_assets_server,
} from 'lib/sys/assets-server-url';


export const HTTP_ENDPOINT_QUIT_PATH     = '/-QUIT-';
export const HTTP_ENDPOINT_FEATURES_PATH = '/-FEATURES-';

export const HTTP_ENDPOINT_BASE_URL = new URL('/', assets_server_url(current_script_url));

export const HTTP_ENDPOINT_QUIT_URL     = new URL(HTTP_ENDPOINT_QUIT_PATH,     HTTP_ENDPOINT_BASE_URL);
export const HTTP_ENDPOINT_FEATURES_URL = new URL(HTTP_ENDPOINT_FEATURES_PATH, HTTP_ENDPOINT_BASE_URL);


export type SERVER_FEATURES = {
    quit:     undefined|string,
    features: undefined|string,
    access: {
        directory: { create: boolean, read: boolean, update: boolean, delete: boolean },
        file:      { create: boolean, read: boolean, update: boolean, delete: boolean },
    },
};

const DEFAULT_SERVER_FEATURES: SERVER_FEATURES = {
    quit:     undefined,
    features: undefined,
    access: {
        directory: { create: false, read: false, update: false, delete: false },
        file:      { create: false, read: true,  update: false, delete: false },
    },
};

// Fetch SERVER_FEATURES from the server during initialization.
// It is assumed these remain the same during operation.
const _server_features: SERVER_FEATURES = await fetch(HTTP_ENDPOINT_FEATURES_URL)
    .then(response => {
        if (!response.ok) {
            return DEFAULT_SERVER_FEATURES;
        } else {
            return response.text()
                .then(body_text => JSON.parse(body_text))
                .catch(error => DEFAULT_SERVER_FEATURES);
        }
    })
    .catch(_ignored_error => false);


export class ServerInterface {
    get CLASS (){ return this.constructor as typeof ServerInterface; }

   static get_features(): SERVER_FEATURES {
        return JSON.parse(JSON.stringify(_server_features));  // return a copy
    }

    async read(url: URL|Location, contents: ReadableStream): Promise<boolean> {
        this.#confirm_access(url, 'read');

        const url_string = url.toString();  // toString() is compatible with both URL and Location
        return fetch(url_string).then(
            response       => response.ok,
            _ignored_error => false,
        );
    }

    async write(url: URL|Location, contents: ReadableStream, update_only=false): Promise<boolean> {
throw new Error('UNIMPLEMENTED');//!!! protect until tested
        this.#confirm_access(url, (update_only ? 'update' : 'create'));

        const url_string = url.toString();  // toString() is compatible with both URL and Location
        return fetch(url_string, {
            method: update_only ? 'PUT' : 'POST',
            body:   contents,
        }).then(
            response       => response.ok,
            _ignored_error => false,
        );
    }

    async remove(url: URL|Location): Promise<boolean> {
throw new Error('UNIMPLEMENTED');//!!! protect until tested
        this.#confirm_access(url, 'delete');

        const url_string = url.toString();  // toString() is compatible with both URL and Location
        return fetch(url_string, {
            method: 'DELETE',
        }).then(
            response       => response.ok,
            _ignored_error => false,
        );
    }

    /** _server_request_quit() is not normally used, included for completeness
     */
    async _server_request_quit(): Promise<boolean> {
        if (!_server_features.quit) {
            throw new Error('server does not support QUIT');
        }

        return fetch(HTTP_ENDPOINT_QUIT_URL).then(
            response       => response.ok,
            _ignored_error => false,
        );
    }

    #confirm_access(url: URL|Location, action: string) {
        if (!url_references_assets_server(url)) {
            throw new Error('url does not reference assets server');
        }

        // When checking access control, we infer if url represents a directory
        // or if it represents a file by looking for a trailing '/' in the
        // pathname.  If this inference turns out to be wrong and access is
        // not actually permitted, then the server will report the error back.
        // The inference can be wrong in two ways, either that a trailing '/'
        // was specified in url but the target is actually a file, or vice versa.
        const action_access: { [action: string]: boolean } = _server_features.access[url.pathname.endsWith('/') ? 'directory' : 'file'];
        if (!action_access[action]) {
            throw new Error(`access server action "${action}" prohibited`);
        }
    }
}
