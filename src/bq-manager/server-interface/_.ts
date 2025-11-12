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


/** DirInfoTemplate defines the contents of entries of the array returned by
 *  ServerInterface when a directory is read.  Actually, DirInfoTemplate
 *  is a type-correct (but invalid) example of one such entry.  The desired
 *  type for declarations, DirInfo, is recovered from DirInfoTemplate via
 *  the typescript typeof type-mode operator.
 *  Why all this complication?  It's because typescript does not provide
 *  a clean way to get the property name of a type object or interface at
 *  run-time.  If there was a utility type that could convert a type
 *  object or interface to an enum type containing all the property names,
 *  then because enums are instantiated as objects at run-time we could
 *  use that.  However, no such utility type exists.
 */
class DirInfoTemplate {
    name:        string = '';
    mode:        number = NaN;
    size:        number = NaN;
    atimeMs:     number = NaN;
    mtimeMs:     number = NaN;
    ctimeMs:     number = NaN;
    birthtimeMs: number = NaN;
};
const dir_info_template = new DirInfoTemplate();
const dir_info_keys_set = (() => { const s = new Set<string>(); for (const key in dir_info_template) s.add(key); return s; })();

/** DirInfo is a typescript type compatible with DirInfoTemplate
 */
export type DirInfo = typeof DirInfoTemplate;

/** is_DirInfo() is a typescript type predicate for DirInfo types
 */
export function is_DirInfo(test: any): test is DirInfo {
    if (typeof test !== 'object') {
        return false;  // indicate: invalid
    } else {
        const all_keys_set = new Set<string>(dir_info_keys_set.values());  // start with a copy of dir_info_keys_set
        for (const key in test) {
            all_keys_set.add(key);
        }
        for (const key of all_keys_set) {
            if ( !(key in test) ||
                 !(key in dir_info_template) ||
                 typeof test[key] !== typeof (dir_info_template as any)[key] )
            {
                return false;  // indicate: invalid
            }
        }
        return true;  // indicate: valid
    }
}


interface FetchOptions {
    method?:  string;
    headers?: any;
    body?:    any;
}


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

    async read(url: URL|Location): Promise<boolean> {
        this.#confirm_access(url, 'read');
        return this.#perform_access(url);
    }

    async write(url: URL|Location, contents: ReadableStream, update_only=false): Promise<boolean> {
throw new Error('UNIMPLEMENTED');//!!! protect until tested
        this.#confirm_access(url, (update_only ? 'update' : 'create'));
        return this.#perform_access(url, (update_only ? 'PUT' : 'POST'), contents);
    }

    async remove(url: URL|Location): Promise<boolean> {
throw new Error('UNIMPLEMENTED');//!!! protect until tested
        this.#confirm_access(url, 'delete');
        return this.#perform_access(url, 'DELETE');
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

    #perform_access(url: URL|Location, method?: string, contents?: ReadableStream): Promise<boolean> {
        const options: FetchOptions = {};
        if (typeof method !== 'undefined') {
            options.method = method;
        }
        if (typeof contents !== 'undefined') {
            options.body = contents;
        }
        const url_string = url.toString();  // toString() is compatible with both URL and Location
        return fetch(url_string, options)
            .then(
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
        const action_access: { [action: string]: boolean } = url.pathname.endsWith('/')
            ? _server_features.access.directory
            : _server_features.access.file;
        if (!action_access[action]) {
            throw new Error(`access server action "${action}" prohibited`);
        }
    }
}
