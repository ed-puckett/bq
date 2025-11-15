#!/usr/bin/env node

import * as fs   from "node:fs";
import * as os   from "node:os";
import * as http from "node:http";
import * as path from "node:path";

// create args array to be something like C's argv
const args = process.argv.slice(2);
args.unshift(process.argv[1].replace(/^.*[/]/, ''));


const DEFAULT_HOST   = '127.0.0.1';
const DEFAULT_PORT   = 8000;
const DEFAULT_ACCESS = 'r';

const CONFIG_ENV_VAR_PREFIX = 'HTTP_ENDPOINT_';

const ACCESS_SPECIFIERS = {
    c: { key: 'create', description: 'allow file/directory creation' },
    r: { key: 'read',   description: 'allow file/directory read' },
    u: { key: 'update', description: 'allow file update (not applicable to directories)' },
    d: { key: 'delete', description: 'allow file/directory deletion' },
};

// === TERMINATION ===

const terminate = (exit_code=0) => {
    process.exit(exit_code);
};

const usage_exit = (message='', exit_code=1) => {
    if (message) {
        console.log(`*** ${message}\n`);
    }
    console.log(`\
Usage: ${args[0]} [ OPTION... ]
Where: each OPTION is one of:
${
    Object.entries(config_items)
        .map(([key, item]) => {
            return `    --${key.padEnd(config_items_key_length_max, ' ')}   ${item.description}${('default' in item) ? ` (DEFAULT: "${item.default}")` : ''}`;
        })
        .join('\n')
}

For options that require an argument, the argument may be specified as
the next command line argument or by appeneding =value to the key.

Access capabilities are specified as a string of one or more of the characters:

${
    Object.entries(ACCESS_SPECIFIERS)
        .map(([ key, { description } ]) => `    ${key}: ${description}`)
        .join('\n')
}

Options my also be specified with environment variables.  However,
command-line arguments take precedence.  Flag-type variables are
considered "true" iff any non-empty string is speficied.  The available
variables are:

${
    Object.keys(config_items)
        .map(key => `    ${CONFIG_ENV_VAR_PREFIX + key.toUpperCase()}`)
        .join('\n')
}
`);
    terminate(exit_code);
};


// === SIGNAL HANDLERS ===

process.once('SIGINT',  () => terminate(0));
process.once('SIGTERM', () => terminate(0));

process.on('unhandledRejection', (reason, promise) => {
    console.error(`ABORT: unhandled promise rejection: ${reason}`, {
        promise,
    });
    terminate(1);
});

process.on('uncaughtException', (error, origin) => {
    console.error(`ABORT: unhandled exception`, {
        origin,
        error,
    });
    terminate(1);
});


// === GET CONFIGURATION ===

const validate_root     = async (root)          => (await fs.promises.stat(root).then(stats => stats.isDirectory(), () => false)) ? undefined : 'root must be a path to a directory';
const validate_host     = async (host)          => (typeof host === 'string' && host.length > 0) ? undefined : 'host must be a nonempty string';
const validate_port     = async (port)          => { const nport = +port; return (Number.isInteger(nport) && 1 <= nport && nport <= 0xFFFF) ? undefined : 'port must be an integer from 1-65535'; };
const validate_quit     = async (quit_path)     => validate_path_arg(quit_path,     'quit');
const validate_features = async (features_path) => validate_path_arg(features_path, 'features');
const validate_access   = async (spec)          => parse_access(spec, true) ? undefined : 'access must specify directory/file access capabilities (see below)';

const validate_path_arg = (path_arg, name) => {
    return (typeof path_arg === 'string' && path_arg.length > 0 && path_arg.match(/^[-._a-zA-Z0-9]+$/))
        ? undefined
        : `${name} must specify a nonempty string of alphanumeric characters or . or - or _`;
};

const parse_access = (spec, dry_run=false) => {
    const match = spec.match(/^(?:(?<directory_access>[CcRrDd]*)[/])?(?<file_access>[CcRrUuDd]*)$/);
    if (dry_run) {
        return match ? true : undefined;
    } else {
        const parse_access_specifiers = (access_text) => {
            access_text = access_text.toLowerCase();
            const specified_access = {};
            for (const [ char, { key } ] of Object.entries(ACCESS_SPECIFIERS)) {
                specified_access[key] = access_text.includes(char);
            }
            return specified_access;
        };
        const access = {};
        const spec_parts = spec.split('/');
        if (spec_parts.length < 2) {
            // only the file portion was specified
            spec_parts.unshift('');  // add in empty directory access specifier
        }
        return {
            directory: parse_access_specifiers(spec_parts[0]),
            file:      parse_access_specifiers(spec_parts[1]),
        };
    }
};

const config_items = {
    root:     {                          validate: validate_root,      description: 'specify server root directory (required)' },
    host:     { default: DEFAULT_HOST,   validate: validate_host,      description: 'specify host for server' },
    port:     { default: DEFAULT_PORT,   validate: validate_port,      description: 'specify port for server' },
    quit:     {                          validate: validate_quit,      description: 'specify pathname that will cause server to quit (optional)' },
    features: {                          validate: validate_features,  description: 'specify pathname to return server features (optional)' },
    access:   { default: DEFAULT_ACCESS, validate: validate_access,    description: 'specify access capabilities (see below)' },
    // items with only flag: true and a description are also supported...
};
const config_items_key_length_max = Math.max(...Object.keys(config_items).map(k => k.length));


const get_config = async () => {
    const config = {};
    // first get defaults, and then values from ENV
    for (const key in config_items) {
        const item = config_items[key];
        // first, set value from default
        let value = item.default;
        // next, get value from ENV
        const env_var = CONFIG_ENV_VAR_PREFIX + key.toUpperCase();
        if (env_var in process.env) {
            value = process.env[env_var];
        }
        if (item.flag) {
            value = !!value;
        }
        config[key] = value;
    }
    // now, parse values from command line
    for (let argnum = 1; argnum < args.length; argnum++) {
        const arg = args[argnum];
        if (!arg.startsWith('--')) {
            usage_exit(`bad option "${arg}"`);
        } else {
            const equals_index = arg.indexOf('=');
            const key = (equals_index === -1) ? arg : arg.slice(2, equals_index);  // handle both --key and --key=value cases
            const item = config_items[key];
            if (!item) {
                usage_exit(`bad option "${arg}"`);
            }
            if (item.flag) {
                config[key] = true;
            } else {
                if (equals_index === -1) {
                    if (argnum >= args.length-1) {
                        usage_exit(`missing value for "${arg}"`);
                    }
                    config[key] = args[++argnum];
                } else {
                    config[key] = arg.slice(equals_index+1);
                }
            }
        }
    }
    // after gathering from various sources, validate the obtained argument values
    for (const key in config_items) {
        const validate = config_items[key].validate;
        if (validate) {
            const value = config[key];
            if (typeof value !== 'undefined') {
                const complaint = await validate(value);
                if (complaint) {
                    usage_exit(complaint);
                }
            }
        }
    }
    // special case: replace access with parsed version
    if (typeof config.access !== 'undefined') {
        config.access = parse_access(config.access ?? DEFAULT_ACCESS);
    }
    // one last thing: convert root path to absolute
    if (config.root) {
        config.root = path.resolve(config.root);
    }
    if (!config.root) {
        usage_exit('root must be specified');
    }
    return config;
};

const config = await get_config();
console.log(config);//!!!

const get_features = () => {
    return ['quit', 'features', 'access']
        .reduce(
            (acc, key) => {
                acc[key] = config[key];
                return acc;
            },
            {},
        );
};

const user_info = os.userInfo();


// === START SERVER ===

const get_file_info = async (full_url_path) => {
    // full_url_path may contain a ? or # suffix
    const url_path = full_url_path.replace(/^([^?#]*)([?#].*)?$/, '$1');
    const file_path = path.join(config.root, url_path);
    const root_specified = url_path === '/';
    const subdirectory_specified = !root_specified && url_path.endsWith('/');
    const ext = path.extname(url_path).substring(1).toLowerCase();
    const path_traversal = !file_path.startsWith(config.root);
    const stats = path_traversal ? undefined : await fs.promises.stat(file_path).catch(() => undefined);
    const found = !!stats;
    return { path_traversal, full_url_path, url_path, file_path, root_specified, subdirectory_specified, ext, stats, found };
};

http
    .createServer(async (req, res) => {
        const log_request = (reported_status) => {
            console.log(`${reported_status} ${req.method} ${req.url}`);
        };
        let status;
        const headers = {};
        const ensure_head_sent = (suggested_status=200, send_status_message=false) => {
            if (send_status_message) {
                // we will add a text message to the response below,
                // so set Content-Type to text (if not already set to something)
                headers['Content-Type'] ??= MIME_TYPES['text'];
            }
            if (!res.headersSent) {
                status ??= suggested_status;
                res.writeHead(status, headers);
                log_request(status);
            }
            if (send_status_message) {
                const description = HTTP_STATUS_CODES[status];
                const message = description
                      ? `${status} ${description}`
                      : `HTTP Status Code: ${status}`;
                res.end(message+'\n');
            }
        };
        try {
            if (config.quit && req.url.slice(1) === config.quit) {  // note: req.url is /something
                // --- special case for quit path ---
                console.log(`QUIT request "${config.quit}" received.`);
                headers['Content-Type'] ??= MIME_TYPES['text'];
                ensure_head_sent(200);
                res.end('** server terminated');
                terminate(0);
            } else if (config.features && req.url.match(new RegExp(`^/${config.features}([?#].*)?$`))) {
                // --- special case for features path ---
                switch (req.method) {
                case 'HEAD': {
                    ensure_head_sent(200);
                    res.end();
                    break;
                }
                case 'GET': {
                    headers['Content-Type'] = MIME_TYPES['json'];
                    ensure_head_sent(200);
                    res.end(JSON.stringify(get_features()));
                    break;
                }
                default: {
                    ensure_head_sent(403, true);
                    break;
                }
                }
            } else {
                // --- not a special features path request, handle normally ---
                switch (req.method) {
                case 'HEAD': {
                    const file_info = await get_file_info(req.url).catch(error => console.error('GET FILE INFO ERROR', error));
                    ensure_head_sent((file_info.found ? 200 : 404));
                    res.end();
                    break;
                }
                case 'GET': {
                    const file_info = await get_file_info(req.url).catch(error => console.error('GET FILE INFO ERROR', error));
                    if (!file_info.found) {
                        ensure_head_sent(404, true);
                    } else if (file_info.stats.isFile()) {
                        const mime_type = MIME_TYPES[file_info.ext] ?? DEFAULT_MIME_TYPE;
                        headers['Content-Type'] = mime_type;
                        if (file_info.stats) {
                            headers['Content-Length'] = file_info.stats.size;
                        }
                        const stream = fs.createReadStream(file_info.file_path);
                        stream
                            .once('data', () => ensure_head_sent())
                            .on('error', (err) => {
                                console.error(`Read error: ${err.message}`)
                                ensure_head_sent(404, true);
                            });
                        stream.pipe(res)
                            .on('error', (error) => {
                                console.error(`Pipe error: ${err.message}`);
                                ensure_head_sent(404, true);
                            });
                    } else if (file_info.stats.isDirectory()) {
                        if (!config.access.directory.read) {
                            ensure_head_sent(403, true);
                        } else {
                            const dir_files = await fs.promises.readdir(file_info.file_path);
                            const dir_stats = await Promise.all(dir_files.map(file_name => {
                                return fs.promises.stat(path.join(file_info.file_path, file_name))
                                    .then(stats => {
                                        const type = stats.isFile()
                                              ? 'file'
                                              : stats.isDirectory()
                                                  ? 'directory'
                                                  : 'other';
                                        const relevant_access_mode = (user_info.uid === -1 || user_info.gid === -1)  // windows sets ids to -1
                                            ? (stats.mode >> 6) & 7  // windows, just use user access mode
                                            : (stats.uid === user_info.uid)  // POSIX
                                                  ? (stats.mode >> 6) & 7        // user
                                                  : (stats.gid === user_info.gid)
                                                        ? (stats.mode >> 3) & 7  // group
                                                        : stats.mode & 7;        // other
                                        return {
                                            name:           file_name,
                                            type,
                                            size:           stats.size,
                                            mode:           relevant_access_mode,
                                            birth_time_ms:  stats.birthtimeMs,
                                            create_time_ms: stats.ctimeMs,
                                            access_time_ms: stats.atimeMs,
                                            modify_time_ms: stats.mtimeMs,
                                        };
                                    });
                            }));
                            headers['Content-Type'] = MIME_TYPES['json'];
                            ensure_head_sent();
                            res.end(JSON.stringify(dir_stats, null, 2));
                        }
                    } else {
                        // unsupported file type
                        ensure_head_sent(403, true);
                        console.error('unsupported file type');
                    }
                    break;
                }
                case 'PUT':
                case 'POST': {
                    const put_request = req.method === 'PUT';
                    const file_info = await get_file_info(req.url).catch(error => console.error('GET FILE INFO ERROR', error));
                    if (file_info.subdirectory_specified) {
                        if (put_request) {
                            // PUT to directory not supported
                            // (not checking access because "update" access for a directory is prohibited (by validation))
                            ensure_head_sent(400, true);
                        } else if (!config.access.directory.create) {
                            ensure_head_sent(400, true);
                        } else if (file_info.found) {
                            // fail creating directory for a path that already exists
                            ensure_head_sent(403, true);
                        } else {
                            fs.promises.mkdir(file_info.file_path)
                                .then(()  => ensure_head_sent(200, true))
                                .catch(() => ensure_head_sent(403, true));
                        }
                    } else {  // reqular non-directory path specified
                        if (!config.access.file[ put_request ? 'update' : 'create' ]) {
                            ensure_head_sent(400, true);
                        } else if (file_info.stats?.isDirectory()) {
                            // fail if file already exists for the path but it is a directory
                            ensure_head_sent(403, true);
                        } else if (put_request && !file_info.found) {
                            // file creation via PUT not supported (must use POST)
                            ensure_head_sent(404, true);
                        } else {
                            const stream = fs.createWriteStream(file_info.file_path, { flags: 'w' });
                            stream
                                .on('error', () => ensure_head_sent(500, true));
                            req.pipe(stream)
                                .on('error',  () => ensure_head_sent(500, true))
                                .on('finish', () => ensure_head_sent(200, true));
                        }
                    }
                    break;
                }
                case 'DELETE': {
                    const file_info = await get_file_info(req.url).catch(error => console.error('GET FILE INFO ERROR', error));
                    if (!config.access[ file_info.stats.isDirectory() ? 'directory' : 'file' ].delete) {
                        ensure_head_sent(400, true);
                    } else if (!file_info.found) {
                        ensure_head_sent(404, true);
                    } else if (file_info.root_specified) {
                        // do not delete the root directory
                        ensure_head_sent(403, true);
                    } else {
                        const remove_path = file_info.stats.isDirectory() ? fs.promises.rmdir : fs.promises.rm;
                        remove_path(file_info.file_path)
                            .then(() => ensure_head_sent(200, true))
                            .catch((error) => ensure_head_sent(403, true));
                    }
                    break;
                }
                default: {
                    ensure_head_sent(400, true);
                    console.error('bad request: unsupported HTTP method', req.method);
                    break;
                }
                }
            }
        } catch (error) {
            ensure_head_sent(500, true);
            console.error('Internal Server Error', error);
        }
    })
    .listen(config.port, config.host);

console.log(`Server ready at http://${config.host}:${config.port}/`);


// === CONSTANTS AND DATA ===

const MIME_TYPES = {
    'manifest': 'text/cache-manifest',
    'text':     'text/plain',
    'txt':      'text/plain',
    'html':     'text/html',
    'htm':      'text/html',
    'css':      'text/css',
    'jpeg':     'image/jpg',
    'jpg':      'image/jpg',
    'png':      'image/png',
    'gif':      'image/gif',
    'svg':      'image/svg+xml',
    'js':       'application/javascript',
    'cjs':      'application/javascript',
    'mjs':      'application/javascript',
    'json':     'application/json',
    'wasm':     'application/wasm',
    'xml':      'application/xml',
    'py':       'text/x-python',
};
const DEFAULT_MIME_TYPE = 'application/octet-stream';

const HTTP_STATUS_CODES = {  // (Oct 2025) from https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml
    100: "Continue",                         // [RFC9110, Section 15.2.1]
    101: "Switching Protocols",              // [RFC9110, Section 15.2.2]
    102: "Processing",                       // [RFC2518]
    103: "Early Hints",                      // [RFC8297]
    104: "Upload Resumption Supported",      // (TEMPORARY - registered 2024-11-13, extension registered 2025-09-15, expires 2026-11-13)  [draft-ietf-httpbis-resumable-upload-05]
    200: "OK",                               // [RFC9110, Section 15.3.1]
    201: "Created",                          // [RFC9110, Section 15.3.2]
    202: "Accepted",                         // [RFC9110, Section 15.3.3]
    203: "Non-Authoritative Information",    // [RFC9110, Section 15.3.4]
    204: "No Content",                       // [RFC9110, Section 15.3.5]
    205: "Reset Content",                    // [RFC9110, Section 15.3.6]
    206: "Partial Content",                  // [RFC9110, Section 15.3.7]
    207: "Multi-Status",                     // [RFC4918]
    208: "Already Reported",                 // [RFC5842]
    226: "IM Used",                          // [RFC3229]
    300: "Multiple Choices",                 // [RFC9110, Section 15.4.1]
    301: "Moved Permanently",                // [RFC9110, Section 15.4.2]
    302: "Found",                            // [RFC9110, Section 15.4.3]
    303: "See Other",                        // [RFC9110, Section 15.4.4]
    304: "Not Modified",                     // [RFC9110, Section 15.4.5]
    305: "Use Proxy",                        // [RFC9110, Section 15.4.6]
    306: "Unused",                           // [RFC9110, Section 15.4.7]
    307: "Temporary Redirect",               // [RFC9110, Section 15.4.8]
    308: "Permanent Redirect",               // [RFC9110, Section 15.4.9]
    400: "Bad Request",                      // [RFC9110, Section 15.5.1]
    401: "Unauthorized",                     // [RFC9110, Section 15.5.2]
    402: "Payment Required",                 // [RFC9110, Section 15.5.3]
    403: "Forbidden",                        // [RFC9110, Section 15.5.4]
    404: "Not Found",                        // [RFC9110, Section 15.5.5]
    405: "Method Not Allowed",               // [RFC9110, Section 15.5.6]
    406: "Not Acceptable",                   // [RFC9110, Section 15.5.7]
    407: "Proxy Authentication Required",    // [RFC9110, Section 15.5.8]
    408: "Request Timeout",                  // [RFC9110, Section 15.5.9]
    409: "Conflict",                         // [RFC9110, Section 15.5.10]
    410: "Gone",                             // [RFC9110, Section 15.5.11]
    411: "Length Required",                  // [RFC9110, Section 15.5.12]
    412: "Precondition Failed",              // [RFC9110, Section 15.5.13]
    413: "Content Too Large",                // [RFC9110, Section 15.5.14]
    414: "URI Too Long",                     // [RFC9110, Section 15.5.15]
    415: "Unsupported Media Type",           // [RFC9110, Section 15.5.16]
    416: "Range Not Satisfiable",            // [RFC9110, Section 15.5.17]
    417: "Expectation Failed",               // [RFC9110, Section 15.5.18]
    418: "Unused",                           // [RFC9110, Section 15.5.19]
    421: "Misdirected Request",              // [RFC9110, Section 15.5.20]
    422: "Unprocessable Content",            // [RFC9110, Section 15.5.21]
    423: "Locked",                           // [RFC4918]
    424: "Failed Dependency",                // [RFC4918]
    425: "Too Early",                        // [RFC8470]
    426: "Upgrade Required",                 // [RFC9110, Section 15.5.22]
    428: "Precondition Required",            // [RFC6585]
    429: "Too Many Requests",                // [RFC6585]
    431: "Request Header Fields Too Large",  // [RFC6585]
    451: "Unavailable For Legal Reasons",    // [RFC7725]
    500: "Internal Server Error",            // [RFC9110, Section 15.6.1]
    501: "Not Implemented",                  // [RFC9110, Section 15.6.2]
    502: "Bad Gateway",                      // [RFC9110, Section 15.6.3]
    503: "Service Unavailable",              // [RFC9110, Section 15.6.4]
    504: "Gateway Timeout",                  // [RFC9110, Section 15.6.5]
    505: "HTTP Version Not Supported",       // [RFC9110, Section 15.6.6]
    506: "Variant Also Negotiates",          // [RFC2295]
    507: "Insufficient Storage",             // [RFC4918]
    508: "Loop Detected",                    // [RFC5842]
    510: "Not Extended (OBSOLETED)",         // [RFC2774][Status change of HTTP experiments to Historic]
    511: "Network Authentication Required",  // [RFC6585]
}
