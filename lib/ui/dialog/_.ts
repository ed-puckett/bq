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
