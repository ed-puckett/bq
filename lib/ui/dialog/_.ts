const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_element,
} from '../dom-tools';

import {
    uuidv4,
} from 'lib/sys/uuid';

import {
    OpenPromise,
} from 'lib/sys/open-promise';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./dialog.css', assets_server_url(current_script_url)));
}


// === DIALOG BASE CLASS ===

export class Dialog {
    get CLASS (){ return this.constructor as typeof Dialog; }

    /** run a new instance of this dialog class
     *  @param {undefined|string} message to be passed to instance run() method
     *  @param {Object|undefined|null} options to be passed to instance run() method
     *  @return {Promise}
     */
    static async run(message?: string, options?: object) { return new this().run(message, options); }

    static _modal_dialog_css_class = 'modal_dialog';

    #opromise = new OpenPromise<undefined|FormData>();

    #dialog_element_id: string = `dialog-${uuidv4()}`;

    #ui_element:            undefined|Element           = undefined;
    _dialog_element:        undefined|HTMLDialogElement = undefined;
    _dialog_text_container: undefined|HTMLElement       = undefined;
    _dialog_form:           undefined|HTMLFormElement   = undefined;
    _dialog_form_content:   undefined|HTMLElement       = undefined;
    _dialog_form_terminals: undefined|HTMLElement       = undefined;

    #completed: boolean = false;
    get completed (){ return this.#completed; }

    constructor() {
        this.#opromise.finally(() => {
            try {
                this._destroy_dialog_element();
            } catch (error) {
                console.warn('ignoring error when finalizing dialog promise', error);
            }
        });
        try {
            this._create_dialog_element();
            if (!this._dialog_element) {
                throw new Error('unexpected: this._dialog_element is not set after calling this._create_dialog_element()');
            } else {
                // this._dialog_element.returnValue is set to '' for declined,
                // and a non-empty string for accepted.  The promise is resolved
                // to undefined for declined, and the FormData for accepted.
                this._dialog_element.returnValue = '';  // default: declined (in case dialog is dismissed with ESC)
                this._dialog_element.onclose = (event) => {
                    if (this._dialog_element?.returnValue === '') {
                        this.#opromise.resolve(undefined);  // indicate: declined
                    } else {
                        this.#opromise.resolve(new FormData(this._dialog_form));  // indicate: accepted
                    }
                }
            }
        } catch (error) {
            this._error(error);
        }
    }

    get promise (){ return this.#opromise.promise; }

    async run(message?: string, options?: object): Promise<undefined|FormData> {
        if (!this._dialog_element) {
            throw new Error('unexpected: dialog element does not exist');
        }
        if (this.#completed) {
            throw new Error('cannot re-run dialog once it is completed');
        }
        this._populate_dialog_element(message, options);
        this._dialog_element.returnValue = '';  // default: declined (in case dialog is dismissed with ESC)
        this._dialog_element.showModal();
        return this.promise;
    }


    // === INTERNAL METHODS ===

    // To be overridden to provide the content of the dialog.
    // this.dialog_element will have already been set and will be part of the DOM.
    _populate_dialog_element(message?: string, options?: object) {
        throw new Error('unimplemented');
    }

    // to be called to accept the dialog
    _accept() {
        this.#completed = true;
        this._dialog_element?.close('accept');  // this._dialog_element.onclose resolves this.#opromise
    }

    // to be called to decline the dialog
    _decline() {
        this.#completed = true;
        this._dialog_element?.close('');  // this._dialog_element.onclose resolves this.#opromise
    }

    _error(error: unknown) {
        this.#opromise.reject(error);
    }

    // expects this.#dialog_element_id is already set, sets this._dialog_element
    _create_dialog_element() {
        if (typeof this.#dialog_element_id !== 'string') {
            throw new Error('this.#dialog_element_id must already be set to a string before calling this method');
        }
        if (typeof this._dialog_element !== 'undefined') {
            throw new Error('this._dialog_element must be undefined when calling this method');
        }
        if (document.getElementById(this.#dialog_element_id)) {
            throw new Error(`unexpected: dialog with id ${this.#dialog_element_id} already exists`);
        }
        if (this.#ui_element) {
            throw new Error('this.#ui_element is already set');
        }
        if (!document.body) {
            document.documentElement.appendChild(document.createElement('body'));
            // document.body is now set
        }
        const parent = document.body;
        this.#ui_element = create_element({
            parent,
            before: null,  // append
        });
        this._dialog_element = create_element({
            parent: this.#ui_element,
            tag:    'dialog',
            attrs: {
                id: this.#dialog_element_id,
                class: this.CLASS._modal_dialog_css_class,
            },
        }) as HTMLDialogElement;
        this._dialog_text_container = create_element({
            parent: this._dialog_element,
            attrs: {
                class: 'dialog-message-text',
            },
        }) as HTMLElement;
        this._dialog_form = create_element({
            parent: this._dialog_element,
            tag:    'form',
            attrs: {
                method: 'dialog',
                class: 'dialog-form',
            },
        }) as HTMLFormElement;
        this._dialog_form_content = create_element({
            parent: this._dialog_form,
            attrs: {
                class: 'dialog-form-content',
            },
        }) as HTMLElement;
        this._dialog_form_terminals = create_element({
            parent: this._dialog_form,
            attrs: {
                class: 'dialog-form-terminals',
            },
        }) as HTMLElement;
    }

    _destroy_dialog_element() {
        if (this.#ui_element) {
            this.#ui_element.remove();
            this.#ui_element = undefined;
        }
    }

    _create_terminal_button(label: string, is_accept: boolean = false): HTMLElement {
        const button = create_element({
            parent: this._dialog_form_terminals,
            tag:    'input',
            attrs: {
                type: is_accept ? 'submit' : 'button',
                value: label,
                class: is_accept ? 'dialog-accept' : 'dialog-decline',
            },
            innerText: label,
        }) as HTMLInputElement;
        button.onclick = is_accept
            ? (event: Event) => this._accept()
            : (event: Event) => this._decline();
        return button;
    }

    _setup_accept_button(options?: object) {
        const {
            accept_button_label = 'Ok',
        } = (options ?? {}) as any;
        const accept_button = this._create_terminal_button(accept_button_label, true);
    }

    _setup_accept_and_decline_buttons(options?: object) {
        const {
            decline_button_label = 'No',
            accept_button_label  = 'Yes',
        } = (options ?? {}) as any;
        const decline_button = this._create_terminal_button(decline_button_label);
        const accept_button  = this._create_terminal_button(accept_button_label, true);
    }
}

export class AlertDialog extends Dialog {
    _populate_dialog_element(message: string, options?: object) {
        if (this._dialog_text_container) {  // test for the sake of typescript...
            this._dialog_text_container.innerText = message;
        }
        this._setup_accept_button(options);
    }
}

export class ConfirmDialog extends Dialog {
    _populate_dialog_element(message: string, options?: object) {
        if (this._dialog_text_container) {  // test for the sake of typescript...
            this._dialog_text_container.innerText = message;
        }
        this._setup_accept_and_decline_buttons(options);
    }
}


// === UTILITY FUNCTIONS ===

/** create a new HTML control as a child of the given parent with an optional label element
 *  @param {Node} parent
 *  @param {undefined|null|string} id for control element
 *  @param {Object|undefined|null} options: {
 *             tag?:         string,   // tag name for element; default: 'input'
 *             type?:        string,   // type name for element; default: 'text' (only used if tag === 'input')
 *             label?:       string,   // if !!label, then create a label element
 *             label_after?: boolean,  // if !!label_after, the add label after element, otherwise before
 *             attrs?:       object,   // attributes to set on the new control element
 *         }
 *  @return {Element} the new control element
 */
export function create_control_element(parent: Node, id?: null|string, options?: object) {
    if (typeof id !== 'undefined' && id !== null && (typeof id !== 'string' || id === '')) {
        throw new Error('id must be undefined, null, or a non-empty string');
    }
    id ??= undefined;  // null -> undefined
    const {
        tag  = 'input',
        type = 'text',
        label,
        label_after,
        attrs = {},
    } = (options ?? {}) as any;

    if (label && !id) {
        throw new Error('id must be a non-empty string if label is specified');
    }
    if ('id' in attrs || 'type' in attrs) {
        throw new Error('attrs must not contain "id" or "type"');
    }

    const control_opts = {
        id,
        ...attrs,
    };
    if (tag === 'input') {
        control_opts.type = type;
    }
    const control = create_element({
        tag,
        attrs: control_opts,
    });
    let control_label: undefined|HTMLLabelElement;
    if (label) {
        control_label = create_element({
            tag: 'label',
            attrs: {
                for: id,  // id may be undefined
            },
        }) as HTMLLabelElement;
        control_label.innerText = label;
    }

    if (label_after) {
        parent.appendChild(control);
        if (control_label) {
            parent.appendChild(control_label);
        }
    } else {
        if (control_label) {
            parent.appendChild(control_label);
        }
        parent.appendChild(control);
    }

    return control;
}

/** create a new HTML <select> and associated <option> elements
 *  as a child of the given parent with an optional label element
 *  @param {Node} parent
 *  @param {undefined|null|string} id for control element
 *  @param {Object|undefined|null} opts: {
 *             tag?:         string,    // tag name for element; default: 'input'
 *             label?:       string,    // if !!label, then create a label element
 *             label_after?: boolean,   // if !!label_after, the add label after element, otherwise before
 *             attrs?:       object,    // attributes to set on the new <select> element
 *             options?:     object[],  // array of objects, each of which contain "value"
 *                                      // and "label" keys (value defaults to label)
 *                                      // values are the option attributes.  If no "value"
 *                                      // attribute is specified then the key is used.
 *                                      // One entry may also contain a boolean "selected".
 *         }
 * Note: we are assuming that opts.options is specified with an key-order-preserving object.
 *  @return {Element} the new <select> element
 */
export function create_select_element(parent: Node, id?: null|string, opts?: object) {
    opts = opts ?? {};
    if ('tag' in (opts as any) || 'type' in (opts as any)) {
        throw new Error('opts must not contain "tag" or "type"');
    }
    const option_elements: HTMLOptionElement[] = [];
    const options = (opts as any).options;
    if (typeof options === 'object') {
        for (const { value, label, selected } of options) {
            const option_attrs = {
                value: (value ?? label),
                selected: selected ? "true" : undefined,
            };
            const option_element = create_element({
                tag: 'option',
                attrs: option_attrs,
            }) as HTMLOptionElement;
            option_element.innerText = label;
            option_elements.push(option_element);
        }
    }
    const select_opts = {
        ...opts,
        tag: 'select',
    };
    const select_element = create_control_element(parent, id, select_opts);
    for (const option_element of option_elements) {
        select_element.appendChild(option_element);
    }
    return select_element;
}
