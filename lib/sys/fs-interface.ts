import {
    OpenPromise,
} from 'lib/sys/open-promise';


class FsInterface {
    get CLASS (){ return this.constructor as typeof FsInterface; }

    // Determine if the File System Access API is available
    static fsaapi_available = ( (globalThis as any).FileSystemHandle &&
                                (globalThis as any).FileSystemFileHandle &&
                                (globalThis as any).FileSystemDirectoryHandle &&
                                typeof (globalThis as any).showOpenFilePicker  === 'function' &&
                                typeof (globalThis as any).showSaveFilePicker  === 'function' &&
                                typeof (globalThis as any).showDirectoryPicker === 'function'    );

    static ensure_fsaapi_available() {
        if (!this.fsaapi_available) {
            throw new Error('unexpected: File System API is not available');
        }
    }

    /** Verify permission to access the given FileSystemHandle, prompting the user if necessary
     *  @param {FileSystemHandle} file_handle
     *  @param {boolean} for_writing
     *  @return {Promise} resolves if permission granted, rejects if permission not granted
     */
    async verify_permission(file_handle?: FileSystemFileHandle, for_writing: boolean = false): Promise<boolean> {
        this.CLASS.ensure_fsaapi_available();
        if (!file_handle) {
            return false;
        }
        const options = {};
        if (for_writing) {
            (options as any).writable = true;  // File System API legacy
            (options as any).mode = 'readwrite';
        }
        return ( await (file_handle as any).queryPermission(options)   === 'granted' ||
                 await (file_handle as any).requestPermission(options) === 'granted'    );
    }

    /** Save text to the file associated with a FileSystemFileHandle,
     *  with the FileSystemFileHandle possibly gotten from prompting user.
     *  @param {async function} get_text nullary function to obtain text to be saved
     *  @param {object} options?: {
     *             file_handle?:    FileSystemFileHandle,  // if given, then open from file_handle without dialog
     *             prompt_options?: object,                // if given, then options for showSaveFilePicker() dialog
     *         }
     *  @return {Promise} resolves to { canceled: true }|{ file_handle: FileSystemFileHandle, stats: object }
     *          where stats is as returned by get_fs_stats_for_file()
     */
    async save( get_text: (() => Promise<string>),
                options?: {
                    file_handle?:    FileSystemFileHandle,  // if given, then open from file_handle without dialog
                    prompt_options?: object,                // if given, then options for showSaveFilePicker() dialog
                } ) {
        if (!this.CLASS.fsaapi_available) {
            return this.legacy_save(get_text, options);
        }

        options ??= {};

        let file_handle = options.file_handle;
        if (!file_handle) {
            const prompt_result = await this.prompt_for_save(options.prompt_options);
            if (!prompt_result.canceled) {
                file_handle = prompt_result.file_handle;
            }
        }
        if (!file_handle) {
            return { canceled: true };
        }

        await this.verify_permission(file_handle, true);
        const text = await get_text();
        const writable = await file_handle.createWritable();
        await writable.write(text);
        await writable.close();
        const stats = await this.get_fs_stats_for_file_handle(file_handle);

        return { file_handle, stats };
    }

    /** Load text from the file associated with a FileSystemFileHandle,
     *  with the FileSystemFileHandle possibly gotten from prompting user.
     *  @param {object} options?: {
     *             file_handle?:    FileSystemFileHandle,  // if given, then open from file_handle without dialog
     *             prompt_options?: object,                // if given, then options for showOpenFilePicker() dialog
     *         }
     *  @return {Promise} resolves to { canceled: true }|{ file_handle: FileSystemFileHandle, text: string, stats: object }
     *          where stats is as returned by get_fs_stats_for_file()
     */
    async open(options?: object) {
        if (!this.CLASS.fsaapi_available) {
            return this.legacy_open(options);
        }

        options ??= {};

        let file_handle = (options as any).file_handle;
        if (!file_handle) {
            const prompt_result = await this.prompt_for_open((options as any).prompt_options);
            if (prompt_result.canceled) {
                return { canceled: true };
            }
            file_handle = prompt_result.file_handle;
        }

        await this.verify_permission(file_handle, false);
        const file = await file_handle.getFile();
        const text = await file.text();
        const stats = this.get_fs_stats_for_file(file);

        return { file_handle, text, stats };
    }

    /** Return stats for the file associated with a FileSystemFileHandle
     *  @param {FileSystemFileHandle} file_handle
     *  @return {Promise} resolves to stats as returned by get_fs_stats_for_file()
     */
    async get_fs_stats_for_file_handle(file_handle: FileSystemFileHandle) {
        this.CLASS.ensure_fsaapi_available();
        await this.verify_permission(file_handle);
        const file = await file_handle.getFile();
        return this.get_fs_stats_for_file(file);
    }

    /** Return stats for the file
     *  @param {File} file
     *  @return {object} stats: {
     *              lastModified:  number,  // the "last modified" time of the file in milliseconds since the UNIX epoch (January 1, 1970 at Midnight UTC)
     *              last_modified: number,  // synonym for lastModified
     *              name:          string,  // name of file
     *              size:          number,  // size of file in bytes
     *              type:          string,  // MIME type of file contents
     *          }
     */
    get_fs_stats_for_file(file: File) {
        const {
            lastModified,
            lastModified: last_modified,
            name,
            size,
            type,
        } = file;

        return {
            lastModified,
            last_modified,
            name,
            size,
            type,
        };
    }

    /** Show a file picker for the user to select a file for saving
     *  @param {object|undefined} options for showSaveFilePicker()
     *  @return {Promise} resolves to { canceled: true }|{ file_handle: FileSystemFileHandle }
     */
    async prompt_for_save(options?: object) {
        this.CLASS.ensure_fsaapi_available();
        const result = await this.#prompt<FileSystemFileHandle>((globalThis as any).showSaveFilePicker, options)
            .catch((error) => {
                if (error instanceof DOMException) {
                    return undefined;
                } else {
                    throw error;
                }
            });
        return result
            ? { file_handle: result }
            : { canceled: true };
    }

    /** Show a file picker for the user to select a file for loading
     *  @param {object|undefined} options for showOpenFilePicker()
     *  @return {Promise} resolves to { canceled: true }|{ file_handle: FileSystemFileHandle }
     */
    async prompt_for_open(options?: object) {
        this.CLASS.ensure_fsaapi_available();
        options ??= {};
        const result = await this.#prompt<FileSystemFileHandle[]>((globalThis as any).showOpenFilePicker, { ...options, multiple: false });
        return result
            ? { file_handle: result[0] }
            : { canceled: true };
    }

    async #prompt<ResultType>(picker: ((options?: object) => Promise<ResultType>), options?: object): Promise<undefined|ResultType> {
        options ??= {};
        let result;
        try {
            result = picker(options);
        } catch (err) {
            // Chromium no longer throws AbortError, instead it throws
            // a DOMException, so just count any exception as "canceled"
            result = undefined;  // indicate: canceled
        }
        return result;
    }

    // === LEGACY ===

    /** Save text to a file chosen by the user with the legacy File API.
     *  @param {async function} get_text nullary function to obtain text to be saved
     *  @param {object} options {
     *             prompt_options?: object,  // if given, then options for showSaveFilePicker() dialog (will be converted)
     *         }
     *  @return {Promise} resolves to { canceled: true }|{ stats: object }
     *          where stats is as returned by get_fs_stats_for_file()
     */
    async legacy_save(get_text: (() => Promise<string>), options?: object) {
        return new Promise(async (resolve, reject) => {
            const text = await get_text();
            const a_el = document.createElement('a') as HTMLAnchorElement;
            a_el.download = this.#get_filename_for_legacy_from_options(options);
            a_el.href = URL.createObjectURL(new Blob([text], { type: 'text/html'}));
            // document.body.addEventListener('focus', ...) does not get activated, even if capture is set, so must use onfocus property
            document.body.onfocus = (event) => {
                document.body.onfocus = null;
                URL.revokeObjectURL(a_el.href);
                a_el.href = '';
                resolve({});//!!! no stats
            };
            a_el.click();
        });
    }

    /** Load text from the file associated with a FileSystemFileHandle,
     *  with the FileSystemFileHandle possibly gotten from prompting user.
     *  @param {object} options {
     *             prompt_options?: object,  // if given, then options for showOpenFilePicker() dialog (will be converted)
     *         }
     *  @return {Promise} resolves to { canceled: true }|{ text: string, stats: object }
     *          where stats is as returned by get_fs_stats_for_file()
     */
    async legacy_open(options?: object) {
        const accept = this.#get_accept_string_for_legacy_from_options(options);

        // For browsers that do not support the File System Access API (e.g., Firefox)
        // opening files is implemented by a file-type input element.  There is a
        // problem with that, though: if the user activates the file open panel and
        // then cancels, no event is emitted that we can use to subsequently remove
        // the input element.
        // Another issue is that the input element will not activate in Firefox (at
        // the time of writing) unless the input element is part of the DOM.
        // Fortunately, the input element need not be displayed in order for it to
        // work.
        // Therefore, once we create the input element, we just leave it in the DOM,
        // hidden, and reuse it whenever necessary.

        let i_el: HTMLInputElement = document.getElementById(this.CLASS.legacy_file_input_element_id) as HTMLInputElement;
        if (!i_el) {
            i_el = document.createElement('input') as HTMLInputElement;
            i_el.id = this.CLASS.legacy_file_input_element_id;
            i_el.classList.add('hidden-fs-interface-element');  // css class definition in notebook/notebook.css
            i_el.type = 'file';
            if (accept) {
                i_el.accept = accept;
            }
            document.body.insertBefore(i_el, document.body.firstChild);  // put at beginning of document body
        }

        const op = new OpenPromise();

        i_el.onchange = async (event) => {
            if (!i_el.files || i_el.files.length <= 0) {
                op.resolve({ canceled: true });
            } else {
                const file = i_el.files[0];
                if (!file) {
                    op.resolve({ canceled: true });
                } else {
                    const text  = await file.text();
                    const stats = this.get_fs_stats_for_file(file);
                    op.resolve({
                        text,
                        stats,
                    });
                }
            }
        };

        // activate the file open panel
        i_el.click();

        return op.promise;
    }

    static legacy_file_input_element_id = 'legacy_file_input_element_id';

    #get_accept_string_for_legacy_from_options(options?: object): string {
        options ??= {};
        const options_accept = (options as any)?.prompt_options?.types?.[0]?.accept;
        const accept = !options_accept ? '' : Object.keys(options_accept).join(',');
        return accept;
    }

    #get_filename_for_legacy_from_options(options?: object): string {
        options ??= {};
        return (options as any)?.prompt_options?.suggestedName ?? 'Untitled.html'
    }
}

export const fs_interface = new FsInterface();
