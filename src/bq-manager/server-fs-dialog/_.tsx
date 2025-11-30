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
    selected_row?: number,  // 0-based, must be a non-negative integer
};

type DIALOG_ACTIONS = {
    perform_submit: (() => void),
    perform_cancel: (() => void),
    update:         ((new_start_url: URL) => void),
};

const SORT_PROP_RE = /^(?<prop>[\w]+)(?:(?<op>[\/%])(?<divisor>[-]?(?:[0-9]+|0b[0-1]+|0o[0-7]+|0x[0-9a-fA-F]+)))?$/;

// data- props:
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
    static directory_chooser_css_class           = 'server-fs-dialog-directory-chooser';
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
            perform_submit: () => {
                const selected_row = dialog.querySelector(`.${this.CLASS.file_list_content_container_css_class} [role="row"][aria-selected="true"][data-url]`);
                if (selected_row instanceof HTMLElement) {
                    const url_string = selected_row.getAttribute('data-url');
                    if (typeof url_string === 'string') {
                        const url = new URL(url_string);
                        if (url.pathname.endsWith('/')) {
                            // directory: keep dialog open and populate from new url
                            update(url);
                        } else {
                            // non-directory file: cleanup and then fulfill the promise with url_string
                            cleanup();
                            promise_data.resolve(url_string);
                        }
                        return;  // skip over error handling at end
                    }
                }
                // fall through to here if cannot find currently-selected url
                console.error('unexpected: perform_submit: unable to find selected row in dialog, performing cancel instead', { selected_row });
                promise_data.resolve(undefined);
            },
            perform_cancel: () => {
                cleanup();
                promise_data.resolve(undefined);
            },
            update: async (new_start_url: URL) => {
                return update(new_start_url);  // update defined below
            },
        };
        const dialog = this.#create_dialog(start_url, dialog_actions, for_save);
        document.body.appendChild(dialog);
        dialog.showModal();

        const update = async (new_start_url: URL) => {
            try {  // to catch errors and close dialog

                start_url = new_start_url;

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
                files_container.appendChild(this.#file_list_from_dir_info(dir_url, dir_info, dialog_actions, {
                    for_save,
                }));

            } catch (error) {
                dialog.close();
                dialog.remove();
                throw error;
            }
        };

        await update(start_url);
        return promise_data.promise as Promise<undefined|string>;
    }

    static #make_keyboard_activation_handler(action: (() => void)) {
        return (event: KeyboardEvent) => {
            switch (event.key) {
                case ' ':
                case 'Enter': {
                    if (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
                        action();
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    break;
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
                    <ol class={this.CLASS.directory_chooser_css_class}>
                    </ol>
                </nav>
                <div class={this.CLASS.files_form_css_class}>
                    <div class={this.CLASS.file_list_holder_css_class}> </div>
                    <div class={this.CLASS.file_list_controls_footer_css_class}>
                        <button tabindex="0" class={this.CLASS.files_form_cancel_button_css_class}>Cancel</button>
                        <button tabindex="0" class={this.CLASS.files_form_submit_button_css_class}>{for_save ? 'Save' : 'Open'}</button>
                    </div>
                </div>
            </dialog>;
        if (!(dialog instanceof HTMLDialogElement)) {
            throw new Error('unexpected: dialog is not an instance of HTMLDialogElement');
        }
        dialog.onclose  = () => dialog_actions.perform_submit();
        dialog.oncancel = () => dialog_actions.perform_cancel();

        const cancel_button = dialog.querySelector(`.${this.CLASS.files_form_cancel_button_css_class}`);
        if (!(cancel_button instanceof HTMLElement)) {
            throw new Error('unexpected: cancel button not found');
        }
        cancel_button.onkeydown = this.CLASS.#make_keyboard_activation_handler(dialog_actions.perform_cancel);
        cancel_button.onclick   = () => dialog_actions.perform_cancel();

        const submit_button = dialog.querySelector(`.${this.CLASS.files_form_submit_button_css_class}`);
        if (!(submit_button instanceof HTMLElement)) {
            throw new Error('unexpected: submit button not found');
        }
        const submit_button_action = () => dialog_actions.perform_submit()
        submit_button.onkeydown = this.CLASS.#make_keyboard_activation_handler(submit_button_action);
        submit_button.onclick   = submit_button_action;

        const directory_chooser = dialog.querySelector(`.${this.CLASS.directory_chooser_css_class}`);
        if (!directory_chooser) {
            throw new Error('unexpected: directory chooser element not found');
        }
        const subdirs = start_url.pathname.split('/');
        for (const subdir of subdirs.slice(0, -1)) {  // omit the last (it represents a file/non-directory or is empty)
            const subdir_element = directory_chooser.appendChild(<li>{subdir || '/'}</li>);
            directory_chooser.appendChild(subdir_element);
        }

        return dialog as HTMLDialogElement;
    }

    /** create HTML markup for a file list from the given dir_info
     */
    #file_list_from_dir_info(
        dir_url:        URL,
        dir_info:       DirInfo[],
        dialog_actions: DIALOG_ACTIONS,
        options:        FILE_LIST_FROM_DIR_INFO_OPTIONS={},
    ): Element {
        const default_sort_col = 0;  // 0-based
        dir_info = [ ...dir_info ];  // copy so that sorting does not affect passed value
        let {
            for_save     = false,
            sort_col     = default_sort_col,  // 0-based
            selected_row = 0,                 // 0-based
        } = options;

        if (dir_info.length === 0) {
            throw new TypeError('dir_info must not be empty');
        }

        // sort_col is validated below
        if (!Number.isInteger(selected_row) || selected_row < 0) {
            throw new TypeError('selected_row must be a non-negative integer');
        }
        // selected_row will be clamped to the integer rangle [0, dir_info.length-1].

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

        const make_file_row = (di: DirInfo, selected: boolean): HTMLElement => {
            // Note that the formatting of each column is not determined by
            // the header's 'data-sort-prop'--that is used for sorting/styling
            // purposes.  The actual formatting of the entries' data is
            // implemented here.
            const is_directory = (di.type === FileType[FileType.directory]);
            const url = new URL(`${di.name}${is_directory ? '/' : ''}`, dir_url).href
            const row_markup =
                <div role="row" data-url={url} aria-selected={selected.toString()}>
                    <div tabindex="0">{/*name, tab-selectable*/}{di.name}</div>
                    <div>{/*size*/}{is_directory ? '-' : format_size(di.size, true, true)}</div>
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
                dialog_actions.perform_submit();
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
                            dialog_actions.perform_submit();
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

        const clamp_selected_row = () => {  // clamp selected_row to the range [0, dir_info.length-1] or 0 if dir_info is empty
            if (selected_row < 0) {
                selected_row = 0;
            } else if (selected_row >= dir_info.length) {
                selected_row = dir_info.length-1;  // dir_info has already been guaranteed not to be empty
            }
        }

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
            clamp_selected_row();
            dir_info.sort(make_sort_function());
            clear_element(content_container);
            dir_info.forEach((di, index) => {
                content_container.appendChild(
                    make_file_row(di, (index === selected_row))
                );
            });
        }

        render();  // initial render

        return file_list;
    }
}
(globalThis as any).ServerFsDialog = ServerFsDialog;//!!!
