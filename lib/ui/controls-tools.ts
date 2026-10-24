import {
    create_element,
} from './dom-tools';


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
        throw new TypeError('id must be undefined, null, or a non-empty string');
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
        throw new TypeError('id must be a non-empty string if label is specified');
    }
    if ('id' in attrs || 'type' in attrs) {
        throw new TypeError('attrs must not contain "id" or "type"');
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
        throw new TypeError('opts must not contain "tag" or "type"');
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


export type RADIO_ALTERNATIVE_SPEC = {
    label:     string;
    label_aux: string;
    details?:  string;
    value?:    string;  // value will be taken from label if value is undefined
    tooltip?:  string;  // if specified, will add a "title" (i.e., tooltip) attribute to the label
};

export function create_radio_control(parent: HTMLElement, legend: string, name: string, checked_value: null|string, alternatives_specs: RADIO_ALTERNATIVE_SPEC[]) {
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

    for (const { label, label_aux, details, value: spec_value, tooltip } of alternatives_specs) {
        const value = spec_value ?? label;
        const child = {
            tag: 'label',
            attrs: {
                title: tooltip ? tooltip : undefined,
            },
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
                {
                    children: [
                        {
                            tag: 'span',
                            attrs: {
                                class: 'export-radio-label',
                            },
                            children: [
                                `${label}:`,  // string: create text node
                            ],
                        },
                        {
                            tag: 'span',
                            attrs: {
                                class: 'export-radio-label-aux',
                            },
                            children: [
                                label_aux,  // string: create text node
                            ],
                        },
                    ],
                },
            ],
        };
        if (details) {
            (child.children[1].children as any).push({
                attrs: {
                    class: 'export-radio-details',
                },
                children: [
                    details.toString(),
                ],
            });
        }
        (spec.children as any).push(child);
    }

    return create_element(spec);
}


export type SELECT_ALTERNATIVE_SPEC = string | {
    label:    string;
    value?:   string;  // value will be taken from label if value is undefined
    tooltip?: string;  // if specified, will add a "title" (i.e., tooltip) attribute to the label
};

export function create_select_control(parent: HTMLElement, label: string, name: string, selected_value: null|string, alternatives_specs: SELECT_ALTERNATIVE_SPEC[]) {
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
        let label, value, tooltip;
        if (typeof spec === 'string') {
            label = spec;
            value = spec;
        } else {
            label   = spec.label;
            value   = spec.value ?? spec.label;
            tooltip = spec.tooltip;
        }
        (select_children as any).push({
            tag: 'option',
            innerText: label,
            attrs: {
                value,
                title: tooltip ? tooltip : undefined,
                selected: (value === selected_value) ? true : undefined,
            },
        });
    }

    return create_element(spec);
}
