const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
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

export function server_get_features(): SERVER_FEATURES {
    // return a copy
    return JSON.parse(JSON.stringify(_server_features));
}

function _throw_access_error(): void {
    throw new Error('unsupported server operation');
}

export async function server_request_quit(): Promise<boolean> {
    if (_server_features.quit) {
        _throw_access_error();
    }

    return fetch(HTTP_ENDPOINT_QUIT_URL).then(
        response       => response.ok,
        _ignored_error => false,
    );
}

export async function server_perform_save(contents: ReadableStream, document_url: URL|Location): Promise<boolean> {
throw new Error('UNIMPLEMENTED');//!!!
    if (_server_features.access.file.create) {
        _throw_access_error();
    }

    const document_url_string = document_url.toString();  // toString() is compatible with both URL and Location
    return fetch(document_url_string, {
        method: 'POST',
        body: contents,
    }).then(
        response       => response.ok,
        _ignored_error => false,
    );
}
