// subordinate types for circularly-dependent Renderer and OutputContext types

export type TextBasedRendererOptionsType = {
    style?:        object,           // css style to be applied to output element
    class?:        string|string[],  // class list to be set (absolute; not just additions or removals)
    inline?:       boolean,          // render inline vs block?
    global_state?: object,           // global_state for rendering; default: ocx.bq.global_state using ocx passed to render()
};

/** Validate options (throwing an Error if validation does not pass), and
 * return undefined if element is already compatible, otherwise return an
 * object that reflects options that is suitable to use for create_element().
 * If always_return_options is true, then return the creation options
 * regardless of element compatibility.
 * @param {Element} element
 * @param {undefined|null|TextBasedRendererOptionsType} options
 * @param {Boolean} always_return_options (default: false)
 * @return {undefined|Object} transformed options
 * @throws {Error} error if options does not pass validation
 */
export function is_compatible_with_options(element: Element, options?: null|TextBasedRendererOptionsType, always_return_options: Boolean = false): undefined|Object {
    let compatible = false;
    let class_string = undefined;
    if (!always_return_options && (typeof options === 'undefined' || options === null)) {
        compatible = true;  // no options
    } else {
        if (options) {  // options may be undefined or null if always_return_options
            if (typeof options !== 'object') {
                throw new TypeError('if given, options must be an object');
            }
            if (typeof options.style !== 'undefined' && typeof options.style !== 'object') {
                throw new TypeError('if given, options.style must be an object');
            }
            if (options.class) {
                if (typeof options.class === 'string') {
                    class_string = options.class.split(' ').filter(cs => (cs.length > 0)).join(' ');
                } else if ( Array.isArray(options.class) &&
                    options.class.every(item => (typeof item === 'string' && !item.includes(' '))) ) {
                    class_string = options.class.filter(cs => (cs.length > 0)).join(' ');
                } else {
                    throw new TypeError('if given, options.class must be a string or an array of strings not containing spaces');
                }
            }
            const empty_style = !options.style || Object.entries(options.style).every(([ key, val ]) => (!key || typeof val === 'undefined'));
            const empty_class = !class_string || class_string.length <= 0;
            //!!! bug: if element is non-block display type and !options.inline and no other style class changes are specified, then creation_options are returned
            if (empty_style && empty_class && !options.inline) {
                compatible = true;  // inconsequential options
            }
        }
    }
    if (compatible && !always_return_options) {
        return undefined;
    } else {
        return {
            tag: options?.inline ? 'span' : 'div',
            style: options?.style,
            attrs: {
                class: class_string,
            },
        };
    }
}
