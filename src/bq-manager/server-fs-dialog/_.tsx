const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
    clear_element,
} from 'lib/ui/dom-tools';

import {
    ServerInterface,
    DirInfo,
    is_DirInfo,
    FileType,
} from '../server-interface';

import {
    format_size,
    format_time,
} from 'lib/sys/formatters';

import {
    _jsx_create_element,
} from 'lib/ui/jsx-create-element';


export async function load_stylesheet(): Promise<void> {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}


type FILE_LIST_FROM_DIR_INFO_OPTIONS = {
    for_save?:     boolean,
    sort_col?:     number,  // 0-based, must be a non-negative integer
};

type DIALOG_ACTIONS = {
    perform_submit: ((direct_activation?: boolean) => void),
    perform_cancel: (() => void),
    set_filename_if_not_updated: ((text: string) => void),
};

const SORT_PROP_RE = /^(?<prop>[\w]+)(?:(?<op>[\/%])(?<divisor>[-]?(?:[0-9]+|0b[0-1]+|0o[0-7]+|0x[0-9a-fA-F]+)))?$/;

// data-* props:
//
//     data-user-updated ... on filename input control, set to "true" if the user
//                           has updated the contained value.
//
//     data-sort-prop ...... on individual file list header elements, specify a
//                           property name in DirInfo with optional /{N} or
//                           %{N} suffix.  If the optional suffix is given,
//                           then sorting is performed numerically (instead
//                           of textually, the normal way), and the value used
//                           for sorting is the value divided/mod-ed by {N}.
//                           N may be a positive or negative integer.
//
//     data-sort-reverse ... on individual file list header elements, if this
//                           attribute is not present or its value is an empty
//                           string then the sort direction is forward, otherwise
//                           the sort direction is reverse.
//
//     data-url ............ on file row elements, gives the url string for the row.
//
//     data-numeric ........ on individual data elements in a file row in the
//                           file list content container, if present and set,
//                           then the data element's contents should be formatted
//                           as a number, otherwise it should be formatted as text.


export class ServerFsDialog {
    get CLASS (){ return this.constructor as typeof ServerFsDialog; }

    static dialog_css_class                      = 'server-fs-dialog';
    static server_css_class                      = 'server-fs-dialog-server';
    static directory_chooser_css_class           = 'server-fs-dialog-directory-chooser';
    static filename_css_class                    = 'server-fs-dialog-filename';
    static files_form_css_class                  = 'server-fs-dialog-files-form';
    static files_form_cancel_button_css_class    = 'server-fs-dialog-files-form-cancel-button';
    static files_form_submit_button_css_class    = 'server-fs-dialog-files-form-submit-button';
    static file_list_holder_css_class            = 'server-fs-dialog-file-list-holder';
    static file_list_css_class                   = 'server-fs-dialog-file-list';
    static file_list_header_container_css_class  = 'server-fs-dialog-file-list-header-container';
    static file_list_header_css_class            = 'server-fs-dialog-file-list-header';
    static file_list_content_container_css_class = 'server-fs-dialog-file-list-content-container';
    static file_list_controls_footer_css_class   = 'server-fs-dialog-file-list-controls-footer';

    async run(server_interface: ServerInterface, start_url: URL, for_save: boolean = false): Promise<undefined|string> {
        const promise_data = Promise.withResolvers();
        const cleanup = () => {
            dialog.close();
            dialog.remove();
        };
        const dialog_actions: DIALOG_ACTIONS = {
            perform_submit: (direct_activation?: boolean) => {
                const chosen_filename = (filename_element as null|HTMLInputElement)?.value ?? '';
                const submit_url = (url: URL) => {
                    if (url.pathname.endsWith('/') && direct_activation) {
                        // directory: keep dialog open and populate from new url
                        update(url);
                    } else {
                        // non-directory file: cleanup and then fulfill the promise with url_string
                        cleanup();
                        const result_url_string = (for_save && chosen_filename) ? new URL(chosen_filename, url).href : url.href
                        promise_data.resolve(result_url_string);
                    }
                };
                const selected_row = dialog.querySelector(`.${this.CLASS.file_list_content_container_css_class} [role="row"][aria-selected="true"][data-url]`);
                if (selected_row instanceof HTMLElement) {
                    const url_string = selected_row.getAttribute('data-url');
                    if (typeof url_string !== 'string') {
                        console.error('unexpected: selected_row does not have a "data-url" attribute', { selected_row });
                        throw new Error('unexpected: selected_row does not have a "data-url" attribute');
                    }
                    submit_url(new URL(url_string));
                } else {
                    // cannot find currently-selected url
                    // use chosen_filename relative to start_url
                    submit_url(new URL(chosen_filename, start_url));
                }
            },
            perform_cancel: () => {
                cleanup();
                promise_data.resolve(undefined);
            },
            set_filename_if_not_updated: (text: string) => {
                if (filename_element) {  // this test is for typescript...
                    if (filename_element.getAttribute('data-user-updated') !== true.toString()) {
                        (filename_element as HTMLInputElement).value = text;
                    }
                }
            }
        };

        const dialog = this.#create_dialog(start_url, dialog_actions, for_save);
        const server_element = dialog.querySelector(`.${this.CLASS.server_css_class}`);
        if (!server_element) {
            throw new Error('unexpected: server element not found');
        }
        const directory_chooser_element = dialog.querySelector(`.${this.CLASS.directory_chooser_css_class}`);
        if (!directory_chooser_element) {
            throw new Error('unexpected: directory chooser element not found');
        }
        const filename_element = dialog.querySelector(`.${this.CLASS.filename_css_class}`);
        if (!filename_element || !(filename_element instanceof HTMLInputElement)) {
            throw new Error('unexpected: filename element not found or not an instance of HTMLInputElement');
        }
        if (for_save) {
            filename_element.oninput = () => {
                filename_element.setAttribute('data-user-updated', (!!filename_element.value).toString());
            };
        } else {
            filename_element.setAttribute('readonly', '');
        }

        document.body.appendChild(dialog);
        dialog.showModal();

        const update = async (new_start_url: URL) => {
            try {  // catch errors and close dialog if they occur

                start_url = new_start_url;

                // update server
                server_element.textContent = start_url.origin;

                // update directory chooser
                if (!(Array<Element>).from(directory_chooser_element.children).every(element => element instanceof HTMLLIElement)) {
                    throw new Error('unexpected: directory_chooser_element.children contains non-HTMLLIElement elements');
                }
                const current_subdir_label_elements = (Array<HTMLLIElement>).from(directory_chooser_element.children);
                const current_subdir_labels = current_subdir_label_elements.map(label_element => label_element.textContent);
                const subdirs = start_url.pathname.split('/');
                const filename = subdirs.splice(-1, 1)[0]  // omit the last subdir from subdirs (it represents a file/non-directory or is empty) and use that for filename
                let chooser_update_diverged = false;
                let path_so_far = '';
                subdirs
                    .map(subdir => `${subdir}/`)
                    .forEach((subdir_label, index) => {
                        path_so_far += subdir_label;
                        let add_new_subdir_label =
                            chooser_update_diverged ||                // will add if already diverged or 
                            (index >= current_subdir_labels.length);  // will add if beyond current
                        if ( !chooser_update_diverged &&
                             index < current_subdir_labels.length &&
                             subdir_label !== current_subdir_labels[index] )
                        {
                            // first divergence, remove all existing labels from this point forward
                            chooser_update_diverged = true;
                            for (let i = index; i < current_subdir_label_elements.length; i++) {
                                current_subdir_label_elements[i].remove();
                            }
                            // note: current_subdir_label_elements and current_subdir_labels will no longer be used...
                            // now, trigger adding this new divergent label (all subsequent labels will be added
                            // from this point forward becase chooser_update_diverged is now true).
                            add_new_subdir_label = true;
                        }
                        if (add_new_subdir_label) {
                            // this new element will be added only if we have diverged
                            const url = new URL(path_so_far, start_url);
                            const subdir_element = <li tabindex="0" url={url.href}>{subdir_label}</li> as HTMLElement;
                            subdir_element.onclick = () => update(url);
                            subdir_element.onkeydown = this.CLASS.#make_keyboard_activation_handler(() => dialog_actions.perform_submit(), () => update(url));
                            directory_chooser_element.appendChild(subdir_element);
                        }
                    });
                // finally, update directory chooser elements aria-checked attribute
                (Array<HTMLLIElement>).from(directory_chooser_element.children).forEach((label_element, index) => {
                    label_element.setAttribute('aria-checked', (index === subdirs.length-1).toString());
                });

                // update filename
                if (filename_element.getAttribute('data-user-updated') !== true.toString()) {  // don't update if user-modified
                    filename_element.value = filename;
                }

                // update file list
                const files_container = dialog.querySelector(`.${this.CLASS.file_list_holder_css_class}`);
                if (!files_container) {
                    throw new Error('unexpected: could not find file list container element');
                }
                const dir_url = new URL('.', start_url);  // new pathname will be containing directory including trailing "/"
                const res = await fetch(dir_url);
                if (!res.body) {
                    console.error('unable to read directory for start_url', { start_url, dir_url, res });
                    throw new Error('unable to read directory for start_url');
                }
                const res_json = await res.text();
                let raw_dir_info: any;
                try {
                    raw_dir_info = JSON.parse(res_json);
                } catch (_) {
                    console.error('reading directory for start_url returned bad JSON', { start_url, dir_url, res });
                    throw new Error('reading directory for start_url returned bad JSON');
                }
                if (!Array.isArray(raw_dir_info) || !raw_dir_info.every(test => is_DirInfo(test))) {
                    console.error('bad response when reading directory', { raw_dir_info });
                    throw new Error('bad response when reading directory');
                }
                const dir_info: DirInfo[] = raw_dir_info;
                files_container.textContent = '';  // clear all children
                files_container.appendChild(this.#file_list_from_dir_info(dir_info, dir_url, filename, dialog_actions, {
                    for_save,
                }));
                // focus on file entry if possible
                (files_container.querySelector('[role="row"][aria-selected="true"] [tabindex="0"]') as null|HTMLElement)?.focus();


            } catch (error) {
                dialog.close();
                dialog.remove();
                throw error;
            }
        };

        await update(start_url);
        return promise_data.promise as Promise<undefined|string>;
    }

    static #make_keyboard_activation_handler(action: (() => void), space_action?: (() => void)) {
        space_action ??= action;
        return (event: KeyboardEvent) => {
            if (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                switch (event.key) {
                    case ' ':
                        space_action();
                        event.preventDefault();
                        event.stopPropagation();
                        break;

                    case 'Enter': {
                        action();
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                    }
                }
            }
        };
    }

    /** create the HTMLServerDialog object by instantiating it from HTML
     */
    #create_dialog(start_url: URL, dialog_actions: DIALOG_ACTIONS, for_save: boolean): HTMLDialogElement {
        const dialog =
            <dialog class={this.CLASS.dialog_css_class}>
                <nav>
                    <div>server:</div>   <div class={this.CLASS.server_css_class}>{/* will be populated by update() */}</div>
                    <div>path:</div>     <ol class={this.CLASS.directory_chooser_css_class}>{/* will be populated by update() */}</ol>
                    <div>filename:</div> <input tabindex={for_save ? "0" : "-1"} type="text" class={this.CLASS.filename_css_class} />
                </nav>
                <div class={this.CLASS.files_form_css_class}>
                    <div class={this.CLASS.file_list_holder_css_class}> </div>
                    <div class={this.CLASS.file_list_controls_footer_css_class}>
                        <button tabindex="0" class={this.CLASS.files_form_cancel_button_css_class}>Cancel</button>
                        <button tabindex="0" class={this.CLASS.files_form_submit_button_css_class}>{for_save ? 'Save' : 'Open'}</button>
                    </div>
                </div>
            </dialog>;

        // validate
        if (!(dialog instanceof HTMLDialogElement)) {
            throw new Error('unexpected: dialog is not an instance of HTMLDialogElement');
        }

        const cancel_button = dialog.querySelector(`.${this.CLASS.files_form_cancel_button_css_class}`);
        if (!(cancel_button instanceof HTMLElement)) {
            throw new Error('unexpected: cancel button not found');
        }
        const cancel_button_action = () => dialog_actions.perform_cancel();

        const submit_button = dialog.querySelector(`.${this.CLASS.files_form_submit_button_css_class}`);
        if (!(submit_button instanceof HTMLElement)) {
            throw new Error('unexpected: submit button not found');
        }
        const submit_button_action = () => dialog_actions.perform_submit();

        // hook events
        dialog.onclose  = submit_button_action;
        dialog.oncancel = cancel_button_action;

        cancel_button.onkeydown = this.CLASS.#make_keyboard_activation_handler(cancel_button_action);
        cancel_button.onclick   = cancel_button_action;

        submit_button.onkeydown = this.CLASS.#make_keyboard_activation_handler(submit_button_action);
        submit_button.onclick   = submit_button_action;

        return dialog as HTMLDialogElement;
    }

    /** create HTML markup for a file list from the given dir_info
     */
    #file_list_from_dir_info(
        dir_info:       DirInfo[],
        dir_url:        URL,
        filename:       string,
        dialog_actions: DIALOG_ACTIONS,
        options:        FILE_LIST_FROM_DIR_INFO_OPTIONS={},
    ): Element {
        const default_sort_col = 0;  // 0-based
        dir_info = [ ...dir_info ];  // copy so that sorting does not affect passed value
        let {
            for_save = false,
            sort_col = default_sort_col,  // 0-based, validated below
        } = options;

        const file_list =
            <div class={this.CLASS.file_list_css_class}>
                <div class={this.CLASS.file_list_header_container_css_class}>
                    <div class={this.CLASS.file_list_header_css_class} scope="col" tabindex="0" data-sort-prop="name">Name</div>
                    <div class={this.CLASS.file_list_header_css_class} scope="col" tabindex="0" data-sort-prop="size/1">Size</div>
                    <div class={this.CLASS.file_list_header_css_class} scope="col" tabindex="0" data-sort-prop="modify_time_ms">Modified</div>
                    <div>{/* manipulation links */}</div>
                </div>
                <div class={this.CLASS.file_list_content_container_css_class}>
                </div>
            </div>;

        const header_container  = file_list.querySelector(`.${this.CLASS.file_list_header_container_css_class}`);
        const content_container = file_list.querySelector(`.${this.CLASS.file_list_content_container_css_class}`);

        if (!header_container || !content_container) {
            throw new Error('unexpected: table elements not found');
        }
        if (!(content_container instanceof HTMLElement)) {
            throw new Error('unexpected: content_container is not an instance of HTMLElement');
        }

        const col_headers = Array.from(header_container.querySelectorAll(`.${this.CLASS.file_list_header_css_class}`)) as Array<HTMLElement>;
        const col_count   = col_headers.length;

        const get_col_info = (col_header: HTMLElement) => {
            const sort_reverse: boolean = access_sort_direction(col_header);
            const sort_prop = col_header.getAttribute('data-sort-prop');
            if (!sort_prop) {
                throw new Error(`unexpected: could not find data-sort-prop attribute for column ${sort_col}`);
            }
            const sort_match = sort_prop.match(SORT_PROP_RE);
            if (!sort_match) {
                throw new Error(`illegal data-sort-prop value for header "${col_header.textContent?.trim()}"`);
            }
            const { prop, op, divisor } = sort_match.groups as { [key: string]: string };
            const divisor_number = +divisor;
            if (op && (Number.isNaN(divisor_number) || divisor_number === 0)) {
                throw new Error(`data-sort-prop with illegal divisor for header "${col_header.textContent?.trim()}"`);
            }
            return {
                sort_reverse,
                sort_prop,
                sort_match,
                prop, op, divisor, divisor_number,
            };
        };

        const select_row = (row: HTMLElement) => {
            if (row.getAttribute('role') !== 'row') {
                throw new TypeError('row does not look incorrect');
            }
            content_container.querySelectorAll('[role="row"][aria-selected="true"]')
                .forEach((selected_row) => selected_row.setAttribute('aria-selected', "false"));
            row.setAttribute('aria-selected', "true");
            const url_string = row.getAttribute('data-url');
            if (!url_string) {
                console.warn('data-url attribute has empty value', { row });
            } else {
                const selected_filename = new URL(url_string).pathname.split('/').slice(-1)[0];
                dialog_actions.set_filename_if_not_updated(selected_filename);
            }
        };

        /** @return {Element} now-selected element
         */
        const select_adjacent_row = (up: boolean) => {
            const current = content_container.querySelector('[role="row"][aria-selected="true"]');
            if (!current) {
                throw new Error('unexpected: selected row not found');
            }
            const adjacent_element = up ? current.previousElementSibling : current.nextElementSibling;
            if (!(adjacent_element instanceof HTMLElement)) {
                return current;
            } else {
                select_row(adjacent_element);
                (adjacent_element.firstChild as null|HTMLElement)?.focus();//!!!
                const scroll_element = adjacent_element.firstElementChild;  // does not work on container, must use firstChild
                scroll_element?.scrollIntoView({ block: "nearest" });
                return adjacent_element;
            }
        };

        const make_file_row = (di: DirInfo, filename: string): HTMLElement => {
            // Note that the formatting of each column is not determined by
            // the header's 'data-sort-prop'--that is used for sorting/styling
            // purposes.  The actual formatting of the entries' data is
            // implemented here.
            const selected = (di.name === filename);
            const is_directory = (di.type === FileType[FileType.directory]);
            const url = new URL(`${di.name}${is_directory ? '/' : ''}`, dir_url).href
            const row_markup =
                <div role="row" data-url={url} aria-selected={selected.toString()}>
                    <div tabindex="0">{/*name, tab-selectable*/}{di.name}</div>
                    <div>{/*size*/}{is_directory ? '-' : format_size(di.size, { powers_of_2: true, with_space: true, pad_units: true })}</div>
                    <div>{/*time*/}{format_time(new Date(di.modify_time_ms))}</div>
                    <div>{/*mods*/}!!!</div>
                </div>;
            const selectable_part = row_markup.querySelector('[tabindex="0"]');
            if (!(selectable_part instanceof HTMLElement)) {
                throw new Error('unexpected: selectable_part is not an instance of HTMLElement');
            }
            col_headers.forEach((col_header: HTMLElement, col_index: number) => {
                // columns that specify an op (and therefore divisor) are considered numeric
                if (get_col_info(col_header).op) {
                    row_markup.children[col_index]?.setAttribute('data-numeric', 'numeric');
                }
            });
            row_markup.onclick = () => {
                select_row(row_markup);
            };
            row_markup.ondblclick = () => {
                dialog_actions.perform_submit(true);
            };
            row_markup.onkeydown = (event: KeyboardEvent) => {
                let stop_event = true;  // will be reset in default, i.e. if event not handled
                switch (event.key) {
                    case 'ArrowUp':
                        select_adjacent_row(true);
                        break;
                    case 'ArrowDown':
                        select_adjacent_row(false);
                        break;
                    case ' ':
                    case 'Enter':
                        if (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                            dialog_actions.perform_submit(event.key === ' ');
                        }
                        break;
                    default:
                        stop_event = false;
                }
                if (stop_event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            };
            selectable_part.onfocus = () => select_row(row_markup);
            if (selected) {
                select_row(row_markup);  // will update other UI elements
            }
            return row_markup;
        }

        const access_sort_direction = (col_header: HTMLElement, toggle_first: boolean = false) => {
            const sort_reverse_attribute_name = 'data-sort-reverse';
            // "reverse" is considered false if the attribute value for
            // sort_reverse_attribute_name is either null (meaning not present)
            // or an empty string.  Otherwise, "reverse" is considered true.
            let value = !!col_header.getAttribute(sort_reverse_attribute_name);  // false if getAttribute returns null or an empty string
            if (toggle_first) {
                value = !value;
                col_header.setAttribute(sort_reverse_attribute_name, (value ? 'reverse' : ''));
            }
            return value;
        };

        const find_checked_header = (): HTMLElement => {
            const checked_header = header_container.querySelector('[aria-checked="true"]') as HTMLElement;
            if (!checked_header) {
                console.error('unable to find checked header');
                throw new Error('unable to find checked header');
            }
            return checked_header;
        };

        // set aria-checked and event handlers for the column headers
        col_headers.forEach((col_header: HTMLElement, col_index: number) => {
            col_header.setAttribute('aria-checked', (col_index === sort_col).toString());
            const handle_header_interaction = () => {
                const clicked_header = col_header;
                if (clicked_header) {  // should always be true
                    const checked_header = find_checked_header();
                    if (clicked_header === checked_header) {
                        access_sort_direction(clicked_header, true);  // toggle
                    } else {
                        checked_header.setAttribute('aria-checked', 'false');
                        clicked_header.setAttribute('aria-checked', 'true');
                    }
                    render();
                }
            };
            col_header.onclick   = () => handle_header_interaction();
            col_header.onkeydown = this.CLASS.#make_keyboard_activation_handler(handle_header_interaction);
        });

        const validate_sort_col = (throw_error_if_invalid=false) => {
            const complaint = (Number.isInteger(sort_col) && 0 <= sort_col && sort_col < col_count )
                ? undefined
                : `col_count must be in the integer range [0, ${col_count-1}]`;
            if (complaint && throw_error_if_invalid) {
                throw new TypeError(complaint);
            }
           return complaint;
        }
        validate_sort_col(true);  // will throw error if sort_col is not valid

        const make_sort_function = (): ((a: any, b: any) => number) => {
            const checked_header = find_checked_header();
            const {
                sort_reverse,
                sort_prop,
                sort_match,
                prop, op, divisor, divisor_number,
            } = get_col_info(checked_header);

            if (!op) {
                // compare as strings
                return !sort_reverse
                    ? (a: any, b: any): number => (((a[prop] as any) === (b[prop] as any)) ? 0 : ((a[prop] as any) < (b[prop] as any)) ? -1 :  1)
                    : (a: any, b: any): number => (((a[prop] as any) === (b[prop] as any)) ? 0 : ((a[prop] as any) < (b[prop] as any)) ?  1 : -1);
            } else {
                // compare as numbers and divide or mod by divisor
                // note: get_col_info() (via SORT_PROP_RE) guarantees that divisor is defined when op is defined
                // note: divisor_number was already validated (integer, not NaN, not 0) by get_col_info()
                const prop_value = (di: any, p: string) => {
                    const value = di[p];
                    if (di.type === FileType[FileType.directory] && p === 'size') {
                        // special case; DirInfo entries for directory files has a
                        // value of 4096 or something and that is not useful here
                        return 0;
                    } else {
                        return value;
                    }
                };
                const xf = (op === '/')
                    ? (di: any) => Math.trunc(prop_value(di, prop) / divisor_number)
                    : (di: any) => prop_value(di, prop) % divisor_number;  // (op === '%')
                return !sort_reverse
                    ? (a: any, b: any): number => (xf(a) - xf(b))
                    : (a: any, b: any): number => (xf(b) - xf(a));
            }
        }

        const render = () => {
            dir_info.sort(make_sort_function());
            clear_element(content_container);
            dir_info.forEach((di, index) => {
                content_container.appendChild(
                    make_file_row(di, filename)
                );
            });
            // if no row is selected, select the first row (if it exists)
            if (dir_info.length > 0 && !content_container.querySelector('[role="row"][aria-selected="true"]')) {
                const first_row = content_container.firstElementChild;
                if (first_row instanceof HTMLElement) {  // satisfy typescript
                    select_row(first_row);
                    first_row.focus();
                }
            }
        }

        render();  // initial render

        return file_list;
    }
}
(globalThis as any).ServerFsDialog = ServerFsDialog;//!!!
