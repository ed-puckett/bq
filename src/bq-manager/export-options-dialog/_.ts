const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
    create_element,
} from 'lib/ui/dom-tools';

import {
    generate_object_id,
} from 'lib/sys/uuid';

import {
    Dialog,
} from 'lib/ui/dialog/_';

import {
    create_radio_control,
    create_select_control,
} from 'lib/ui/controls-tools';

import {
    get_bootstrap_script_src_alternatives,
    bootstrap_script_src_alternatives_default,
    cell_view_attribute_name,
    get_valid_cell_view_values,
    get_cell_view_descriptions,
    cell_view_values_default,
    get_auto_render,
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
            .map( ([ choice, { label, details, url } ]: [ choice: string, _: { label: string, details: string, url: string } ]) => {
                return {
                    value:     choice,
                    label,
                    label_aux: url,
                    details,
                    tooltip:   `script url: ${url}`,
                };
            } );
        create_radio_control(this._dialog_form_content, 'Bootstrap script', 'bootstrap_script_src', bss_choices_default, bss_choices);

        // --- cell view ---

        const cv_current = document.documentElement.getAttribute(cell_view_attribute_name);
        const cv_unset_choice = '(unset)';
        const cv_unset_value = '';  // must be empty string; this will be recognized by caller as "unset"
        const cv_choices_default = cv_current ?? cv_unset_value;
        const cv_choices_standard = get_valid_cell_view_values();
        const cv_descriptions = get_cell_view_descriptions();
        if (cv_choices_standard.includes(cv_unset_value)) {
            throw new Error('unexpected: valid_cell_view_values already includes cv_unset_value');
        }
        if (cv_choices_standard.includes(cv_unset_choice)) {
            throw new Error('unexpected: valid_cell_view_values already includes cv_unset_choice');
        }
        const cv_choices = [
            {
                value: cv_unset_value,
                label: cv_unset_choice,
            },
            ...Object.entries(cv_descriptions).map( ([ value, description ]) => {
                return {
                    value,
                    label:   value,
                    tooltip: description,
                };
            }),
        ];
        const cv_element_tree = create_select_control(this._dialog_form_content, 'Cell view', 'cell_view', cv_choices_default, cv_choices);
        const cv_description_element = create_element({
            parent: cv_element_tree,
            attrs: {
                class: 'export-cell-view-description',
            },
            innerText: ' ',
        }) as HTMLElement;
        const cv_select_element = cv_element_tree.querySelector('select') as null|HTMLSelectElement;
        if (cv_select_element) {
            function update_cv_description() {
                const value = cv_select_element?.value;
                if (value) {
                    const description = (cv_descriptions as any)[value];
                    if (description) {
                        cv_description_element.innerText = description;
                        return;
                    }
                }
                cv_description_element.innerText = ' ';  // clear if nothing matched
            }
            update_cv_description();
            cv_select_element.onchange = (event) => update_cv_description();
        }

        // --- auto-render? ---

        create_element({
            parent: this._dialog_form_content,
            tag: 'label',
            children: [
                'Auto-render saved notebook when loading',  // string: create text node
                {
                    tag: 'input',
                    attrs: {
                        type: 'checkbox',
                        name: 'auto_render',
                        checked: get_auto_render() ? true : undefined,
                    },
                },
            ],
        });

        // --- save active cell? ---

        create_element({
            parent: this._dialog_form_content,
            tag: 'label',
            children: [
                'Preserve current active cell setting in saved notebook',  // string: create text node
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
