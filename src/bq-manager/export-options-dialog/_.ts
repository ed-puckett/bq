const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
    create_element
} from 'lib/ui/dom-tools';

import {
    generate_object_id,
} from 'lib/sys/uuid';

import {
    Dialog,
} from 'lib/ui/dialog/_';

import {
    get_bootstrap_script_src_alternatives,
    bootstrap_script_src_alternatives_default,
    cell_view_attribute_name,
    get_valid_cell_view_values,
    get_cell_view_descriptions,
    cell_view_values_default,
    get_auto_eval,
} from 'src/init';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}


export class ExportOptionsDialog extends Dialog {
    get CLASS (){ return this.constructor as typeof ExportOptionsDialog; }

    static css_class = 'export-options-dialog';

    _populate_dialog_element(message?: string, options?: object): void {
        if (!this._dialog_form_content) {  // this is for typescript....
            throw new Error('unexpected: this._dialog_form_content not set');
        }

        message ??= 'Export Options';
        this._dialog_element?.classList.add(this.CLASS.css_class);
        if (this._dialog_text_container) {  // test for the sake of typescript...
            this._dialog_text_container.innerText = message;
        }

        this._setup_accept_and_decline_buttons({
            decline_button_label: 'Cancel',
            accept_button_label:  'Continue',
        });

        // --- bootstrap script choices ---

        const bss_choices_default = bootstrap_script_src_alternatives_default;
        const bss_choices = Object.entries(get_bootstrap_script_src_alternatives())
            .map( ([ choice, { description, url } ]: [ choice: string, _: { description: string, url: string } ]) => {
                return {
                    value: choice,
                    label: description,
                };
            } );
        create_radio_control(this._dialog_form_content, 'Bootstrap script', 'bootstrap_script_src', bss_choices_default, bss_choices);

        // --- cell view ---

        const cv_current = document.documentElement.getAttribute(cell_view_attribute_name);
        const cv_unset_choice = '(unset)';
        const cv_unset_value = '';  // must be empty string; this will be recognized by caller as "unset"
        const cv_choices_default = cv_current ?? cv_unset_value;
        const cv_choices_standard = get_valid_cell_view_values();
        if (cv_choices_standard.includes(cv_unset_value)) {
            throw new Error('unexpected: valid_cell_view_values already includes cv_unset_value');
        }
        if (cv_choices_standard.includes(cv_unset_choice)) {
            throw new Error('unexpected: valid_cell_view_values already includes cv_unset_choice');
        }
        const cv_choices = [
            {
                label: cv_unset_choice,
                value: cv_unset_value,
            },
            ...cv_choices_standard,
        ];
        create_select_control(this._dialog_form_content, 'Cell view', 'cell_view', cv_choices_default, cv_choices);

        // --- auto-eval? ---

        create_element({
            parent: this._dialog_form_content,
            tag: 'label',
            children: [
                'Auto-eval notebook',  // string: create text node
                {
                    tag: 'input',
                    attrs: {
                        type: 'checkbox',
                        name: 'auto_eval',
                        checked: get_auto_eval() ? true : undefined,
                    },
                },
            ],
        });

        // --- save active cell? ---

        create_element({
            parent: this._dialog_form_content,
            tag: 'label',
            children: [
                'Save active cell setting',  // string: create text node
                {
                    tag: 'input',
                    attrs: {
                        type: 'checkbox',
                        name: 'active_cell',
                        checked: undefined,
                    },
                },
            ],
        });
    }
}


type RADIO_ALTERNATIVE_SPEC = {
    label:  string;
    value?: string;  // value will be taken from label if value is undefined
};

function create_radio_control(parent: HTMLElement, legend: string, name: string, checked_value: null|string, alternatives_specs: RADIO_ALTERNATIVE_SPEC[]) {
    const spec = {
        parent,
        tag: 'fieldset',
        children: [
            {
                tag: 'legend',
                innerText: legend,
            },
        ],
    };

    for (const { label, value: spec_value } of alternatives_specs) {
        const value = spec_value ?? label;
        (spec.children as any).push({
            tag: 'label',
            children: [
                {
                    tag: 'input',
                    attrs: {
                        type: 'radio',
                        name,
                        value,
                        checked: (value === checked_value) ? true : undefined,
                    },
                },
                label,  // string: create text node
            ],
        });
    }

    return create_element(spec);
}


type SELECT_ALTERNATIVE_SPEC = string | {
    label:  string;
    value?: string;  // value will be taken from label if value is undefined
};

function create_select_control(parent: HTMLElement, label: string, name: string, selected_value: null|string, alternatives_specs: SELECT_ALTERNATIVE_SPEC[]) {
    const spec = {
        parent,
        tag: 'label',
        children: [
            label,  // string: create text node
            {
                tag: 'select',
                attrs: {
                    name,
                },
                children: [],  // populated below
            },
        ],
    };

    const select_children = (spec.children[spec.children.length-1] as any).children;

    for (const spec of alternatives_specs) {
        let label, value;
        if (typeof spec === 'string') {
            label = spec;
            value = spec;
        } else {
            label = spec.label;
            value = spec.value ?? spec.label;
        }
        (select_children as any).push({
            tag: 'option',
            innerText: label,
            attrs: {
                value,
                selected: (value === selected_value) ? true : undefined,
            },
        });
    }

    return create_element(spec);
}
