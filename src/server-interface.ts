const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


export const HTTP_ENDPOINT_QUIT_PATH                 = '/QUIT';
export const HTTP_ENDPOINT_FSAPI_CHECK_PATH          = '/FSAPI';
export const HTTP_ENDPOINT_FSAPI_CHECK_PATH_RESPONSE = 'FSAPI AVAILABLE';

export const HTTP_ENDPOINT_BASE_URL = new URL('/', assets_server_url(current_script_url));

export const HTTP_ENDPOINT_QUIT_URL        = new URL(HTTP_ENDPOINT_QUIT_PATH,        HTTP_ENDPOINT_BASE_URL);
export const HTTP_ENDPOINT_FSAPI_CHECK_URL = new URL(HTTP_ENDPOINT_FSAPI_CHECK_PATH, HTTP_ENDPOINT_BASE_URL);


export const server_fsapi_available : boolean = await fetch(HTTP_ENDPOINT_FSAPI_CHECK_URL)
    .then(response => {
        if (!response.ok) {
            return false;
        } else {
            return response.text()
                .then(body_text => {
                    return (body_text === HTTP_ENDPOINT_FSAPI_CHECK_PATH_RESPONSE);
                });
        }
    })
    .catch(_ignored_error => false);

export function ensure_server_fsapi_available(): void {
    if (!server_fsapi_available) {
        throw new Error('server does not support fsapi operations');
    }
}

export async function server_request_quit(): Promise<boolean> {
    ensure_server_fsapi_available();

    return fetch(HTTP_ENDPOINT_QUIT_URL).then(
        response       => response.ok,
        _ignored_error => false,
    );
}

export async function server_perform_save(contents: ReadableStream, document_url: URL|Location): Promise<boolean> {
    ensure_server_fsapi_available();

    const document_url_string = document_url.toString();  // toString() is compatible with both URL and Location
    return fetch(document_url_string, {
        method: 'POST',
        body: contents,
    }).then(
        response       => response.ok,
        _ignored_error => false,
    );
}
