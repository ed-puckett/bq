const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    generate_object_id,
} from 'lib/sys/uuid';

import {
    beep,
} from 'lib/ui/beep';


// === TIMEOUT / NEXT TICK UTILITIES ===

export async function delay_ms(ms?: number, resolve_result?: () => void): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, (ms ?? 0), resolve_result));
}

export async function next_tick(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve));
}

export async function next_micro_tick(): Promise<void> {
    return new Promise(resolve => queueMicrotask(resolve));
}


// === NODE/ELEMENT UTILITIES ===

/** set an event handler on the given textarea so that it automatically resizes based on content
 * @param {HTMLTextAreaElement} textarea
 * The oninput event handler attribute of textarea is changed and used by this function.
 */
export function setup_textarea_auto_resize(textarea: HTMLTextAreaElement, max_height_px?: number): void {
    if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('textarea must be an instance of HTMLTextAreaElement');
    }
    if (typeof max_height_px !== 'undefined' && max_height_px !== null && (typeof max_height_px !== 'number' || max_height_px <= 0)) {
        throw new Error('max_height_px must be undefined, null, or a positive number');
    }
    const initial_height = (textarea.scrollHeight > 0) ? `${textarea.scrollHeight}px` : '0.5em';
    textarea.setAttribute('style', `height:${initial_height}; overflow-y:hidden;`);
    textarea.oninput = function textarea_input_handler(event: Event) {
        if (event.target && event.target instanceof Element) {
            const textarea = event.target.closest('textarea');
            if (textarea) {
                textarea.style.height = '1px';  // prevent height from interfering with scrollHeight
                const cs = window.getComputedStyle(textarea);
                // note: all css dimensional values are floating-point values followed by 'px'
                const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
                const calculated_height = textarea.scrollHeight - paddingY;
                const new_height = (max_height_px && calculated_height > max_height_px) ? max_height_px : calculated_height;
                textarea.style.height = `${new_height}px`;
            }
        }
    };
}
/** trigger resize on a textarea that was setup for auto resize by
 *  setup_textarea_auto_resize().
 * @param {HTMLTextAreaElement} textarea
 */
export function trigger_textarea_auto_resize(textarea: HTMLTextAreaElement): void {
    if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('textarea must be an instance of HTMLTextAreaElement');
    }
    textarea.dispatchEvent(new Event('input'));  // trigger resize
}

/** find the nearest ancestor of node that matches selector
 *  @param {Node} node for which to find nearest ancestor
 *  @param {String} selector to match
 *  @param {Boolean} strict_ancestor if true, then don't return node even if it matches
 *  @return {Element} the ancestor or null if none found
 */
export function find_matching_ancestor(node: Node, selector: string, strict_ancestor: boolean = false): null|Element {
    for (let scan = (strict_ancestor ? node.parentNode : node); scan; scan = scan.parentNode) {
        if (scan instanceof Element) {
            if (scan.matches(selector)) {
                return scan;
            }
        }
    }
    return null;  // indicate: not found
}

/** remove all child elements and nodes of element
 *  @param {Node} element
 */
export function clear_element(element: Node): void {
    if (element instanceof HTMLElement) {
        element.innerText = '';  // removes all child elements and nodes, and their event handlers
    } else if (element instanceof Node) {
        while (element.firstChild) {
            // note that removeChild() does not remove the
            // event handlers from the removed node, but
            // we are letting the node go so it will be
            // garbage-collected soon....
            element.removeChild(element.firstChild);
        }
    } else {
        throw new Error('element must be an instance of Node');
    }
}

/** Test if element is in DOM and visible.
 * @param {Element} element
 * @param {undefined|null|number} vpos
 * @param {undefined|null|number} hpos
 * @return {Boolean} visible with respect to vpos and hpos
 * vpos and hpos specify which point in the element should be tested
 * where null specifies not checking that direction (v or h) at all,
 * undefined (or parameter omitted) specifies checking that the element
 * is fully visible, and a number specifies a fraction used to check that
 * a single point is visible where the point the fraction of the length in
 * that dimension.  For example, hpos === 0 means check at the beginning,
 * hpos === 1 means check at the end, and hpos === 0.5 means check the middle.
 */
export function is_visible(element: Element, vpos: undefined|null|number, hpos: undefined|null|number): boolean {
    if (!(element instanceof Element)) {
        throw new Error('element must be an instance of Element');
    }
    if (typeof vpos !== 'undefined' && vpos !== null && typeof vpos !== 'number') {
        throw new Error('vpos must be undefined, null or a number');
    }
    if (typeof hpos !== 'undefined' && hpos !== null && typeof hpos !== 'number') {
        throw new Error('hpos must be undefined, null or a number');
    }

    if (!document.documentElement.contains(element)) {
        return false;
    }

    const element_rect = element.getBoundingClientRect();

    const in_rect_v =
        (vpos === null)                 ? ((r: DOMRect) => true)
        : (typeof vpos === 'undefined') ? ((r: DOMRect) => element_rect.top >= r.top && element_rect.bottom <= r.bottom)
        :                          ((v) => (r: DOMRect) => v >= r.top && v <= r.bottom)((element_rect.top  + vpos*element_rect.height));
    const in_rect_h =
        (hpos === null)                 ? ((r: DOMRect) => true)
        : (typeof hpos === 'undefined') ? ((r: DOMRect) => element_rect.left >= r.left && element_rect.right <= r.right)
        :                          ((h) => (r: DOMRect) => h >= r.left && h <= r.right)(element_rect.left + hpos*element_rect.width);
    const in_rect = (r: DOMRect) => in_rect_v(r) && in_rect_h(r);

    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const parent_rect = parent.getBoundingClientRect();
        if (!in_rect(parent_rect)) {
            return false;
        }
    }

    return true;  // visible all the way up the parent chain according to criteria
}

/** return a boolean indicating whether the given element is scrollable or not
 * @param {Element} element
 * @return {Boolean} element is scrollable
 * adapted from: https://stackoverflow.com/questions/35939886/find-first-scrollable-parent / Gabriel Jablonski answer
 */
export function is_scrollable(element: Element): boolean {
    const style = getComputedStyle(element);
    return ['overflow', 'overflow-x', 'overflow-y'].some((propertyName) => {
        const value = style.getPropertyValue(propertyName);
        return value === 'auto' || value === 'scroll';
    });
}

/** return the first scollable parent of element
 * @param {Element} element
 * @return {null|Element} first parent element that is scrollable, or null if none
 */
export function scrollable_parent(element: Element): null|Element {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (is_scrollable(parent)) {
            return parent;
        }
    }
    return null;
}

/** set attributes on an element which are taken from an object.
 *  @param {Element} element
 *  @param {Object} attrs
 * Attributes specified in attrs with a value of undefined or null cause
 * the corresponding property to be removed.
 * Attribute values obtained by calling toString() on the values in attrs
 * except that values which are undefined are translated to ''.
 */
export function set_element_attrs(element: Element, attrs: { [attr: string]: undefined|null|string }): void {
    if (attrs) {
        if ('id' in attrs && document.getElementById(attrs.id ?? '')) {
            throw new Error(`element already exists with id ${attrs.id}`);
        }
        for (const k in attrs) {
            const v = attrs[k];
            if (v === null || typeof v === 'undefined') {
                element.removeAttribute(k);
            } else {
                element.setAttribute(k, v);
            }
        }
    }
}

/** add/remove style properties on element
 *  @param {HTMLElement} element
 *  @param {Object} spec collection of properties to add or remove.
 *                  If the value of an entry is null or undefined, then
 *                  the corresponding property is removed.  Otherwise,
 *                  the value of the corresponding property is set.
 */
export function update_element_style(element: HTMLElement, spec: { [prop: string]: undefined|null|string }): void {
    for (const name in spec) {
        const value = spec[name];
        if (value === null || typeof value === 'undefined') {
            element.style.removeProperty(name);
        } else {
            element.style.setProperty(name, value);
        }
    }
}

/** safely set namespaced attributes
 *  @param {Element} element on which to set attribute
 *  @param {String|null} namespace
 *  @param {String} name of attribute
 *  @param {any} value
 * According to MDN, https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttributeNS :
 *     setAttributeNS is the only method for namespaced attributes which
 *     expects the fully qualified name, i.e. "namespace:localname".
 */
export function safe_setAttributeNS(element: Element, namespace: string, name: string, value: string): void {
    //!!! is this a correct implementation???
    if (namespace && !name.includes(':')) {
        // use the last non-empty component of the namespace
        //!!! is this correct?
        const namespace_components = new URL(namespace).pathname.split('/');
        const namespace_specfier = namespace_components.findLast(s => s.length > 0);
        name = `${namespace_specfier}:${name}`;
    }
    element.setAttributeNS(namespace, name, value);
}


/** validate the "parent" and "before" properties from options and return their validated values.
 *  @param {null|undefined|Object} options
 *  @param {Class} required_parent_class (default Element)
 *  @return {Object} result: { parent: Node|null, before: Node|null }
 */
export function validate_parent_and_before_from_options( options: { parent?: any, before?: any },
                                                         required_parent_class?: Function ): { parent: Node|null, before: Node|null } {
    const {
        parent: parent_from_options = null,
        before = null,
    } = (options ?? {});

    let parent = parent_from_options;
    if (before && !(before instanceof Node)) {
        throw new Error('before must be null, undefined, or an instance of Node');
    }

    if (before && !before.parentNode) {
        throw new Error('before must have a parent');
    }

    // resolve parent and before
    if (parent) {
        if (before && before.parentElement !== parent) {
            throw new Error('inconsistent parent and before nodes specified');
        }
    } else {
        if (before) {
            parent = before.parentNode;
        }
    }

    if (parent && required_parent_class && !(parent instanceof required_parent_class)) {
        throw new Error(`parent must be null, undefined, or an instance of ${required_parent_class.name}`);
    }

    return { parent, before };
}

/** This is the key under which create_element_mapping() and
 *   create_element_or_mapping(..., true) returns the top-level object.
 */
export const mapping_default_key = 'default';

/** create_element_or_mapping(options=null, return_mapping=false)
 *  create a new element with the given characteristics
 *  @param {Object|undefined|null} options: {
 *      _key?:      String,     // if return_mapping, associate the created element with this value as the key
 *      parent?:    Node|null,  // parent element, null or undefined for none; may be simply an Element if style not specified
 *      before?:    Node|null,  // sibling node before which to insert; append if null or undefined
 *      tag?:       string,     // tag name for new element; default: 'div'
 *      namespace?: string,     // namespace for new element creation
 *      attrs?:     object,     // attributes to set on new element
 *      style?:     object,     // style properties for new element
 *      set_id?:    Boolean     // if true, allocate and set an id for the element (if id not specified in attrs)
 *      children?:  ELDEF[],    // array of children to create (recursive)
 *      innerText?: string,     // innerText to set on element (invalid if "children" or "innerHTML" specified)
 *      innerHTML?: string,     // innerHTML to set on element (invalid if "children" or "innerText" specified)
 *  }
 *  @param {Boolean} return_mapping (default false)
 *  @return {Element|Object} the new element or the element mapping object
 *
 * A unique id will be assigned to the element unless that element already has
 * an id attribute specified (in attrs).
 * Attributes specified in attrs with a value of undefined are ignored.
 * The before node, if specified, must have a parent that must match parent if
 * parent is specified.
 * If neither parent nor before is specified, the new element will have no parent.
 * Warning: '!important' in style specifications does not work!  (Should use priority method.)
 * The definitions in "children", if specified, should not contain "parent" or "before".
 * attrs may contain a "class" property, and this should be a string or an array of strings,
 * each of which must not contain whitespace.
 *
 * If return_mapping, then return a mapping object from keys found in "_key" properties
 * in the options.  Each of these keys will be mapped to the corresponding object, and
 * mapping_default_key is mapped to the top-level object.  Note that duplicate keys or
 * keys that specify the same value as mapping_default_key will overwrite earlier values.
 * Elements specified in options are created in a post-order traversal of options.children.
 * This means that a _key specified in options as mapping_default_key will not be returned
 * because mapping_default_key is set after traversiing the children.
 */
export function create_element_or_mapping(options?: object, return_mapping: boolean = false): Element|object {
    options ??= {};
    if (typeof options !== 'object') {
        throw new Error('options must be null, undefined, or an object');
    }
    const {
        _key,
        tag = 'div',
        namespace,
        attrs,
        style,
        set_id,
        children,
        innerText,
        innerHTML,
    } = (options as any);

    const {
        parent,
        before,
    } = validate_parent_and_before_from_options(options);

    if (typeof children !== 'undefined' && children !== null) {
        if (!Array.isArray(children) || !children.every(child => ['object', 'string' ].includes(typeof child))) {
            throw new Error('children must be an array of objects');
        }
        if (typeof innerText !== 'undefined' || typeof innerHTML !== 'undefined') {
            throw new Error('"innerText" or "innerHTML" may not be specified if "children" is specified');
        }
    }
    if (typeof innerText !== 'undefined' && typeof innerHTML !== 'undefined') {
        throw new Error('"innerText" or "innerHTML" must not both be specified');
    }

    const element = namespace
          ? document.createElementNS(namespace, tag)
          : document.createElement(tag);

    let element_id_specified = false;
    if (attrs) {
        for (const k in attrs) {
            let v = attrs[k];
            if (k === 'class' && Array.isArray(v)) {
                if (!v.every(c => !c.match(/\s/))) {
                    throw new Error('attrs.class must be a string or an array of strings not containing whitespace');
                }
                v = v.join(' ');
            }
            if (k === 'id') {
                element_id_specified = true;
            }
            if (typeof v !== 'undefined') {
                element.setAttribute(k, v);
            }
        }
    }
    if (!element_id_specified && set_id) {
        element.id = generate_object_id();
    }

    // update style after attrs in case a style attribute is also specified
    if (style) {
        update_element_style(element, style);
    }

    const mapping = return_mapping ? {} : undefined;

    if (children) {
        for (const child_desc of children) {
            if (typeof child_desc === 'string') {
                element.appendChild(document.createTextNode(child_desc));
            } else {
                if (child_desc.parent || child_desc.before) {
                    console.warn('ignoring "parent" and/or "before" specified in child descriptor');
                }
                const child_result = create_element_or_mapping({
                    ...child_desc,
                    parent: element,
                    before: undefined,
                }, return_mapping);

                if (return_mapping) {
                    Object.assign((mapping as object), child_result);
                }
            }
        }
    }

    for (const [ value, setter_name, setter ] of [
        [ innerText, 'innerText', (el: HTMLElement, v: any) => { el.innerText = v; } ],
        [ innerHTML, 'innerHTML', (el: HTMLElement, v: any) => { el.innerHTML = v; } ],
    ]) {
        if (typeof value !== 'undefined') {
            if (! (element instanceof HTMLElement)) {
                throw new Error(`${setter_name} specified for Element but must be HTMLElement`);
            }
            setter(element, value);
        }
    }

    if (return_mapping && mapping) {
        (mapping as any)[mapping_default_key] = element;
        if ([ 'string', 'symbol' ].includes(typeof _key)) {
           (mapping as any)[_key] = element;
        }
    }

    if (parent) {
        parent.insertBefore(element, before);
    }

    return return_mapping ? mapping : element;
}

export function create_element(options?: object): Element {
    return create_element_or_mapping(options, false) as Element;
}

/** create_element_mapping(options=null)
 *  use create_element_or_mapping() passing return_mapping=true.
 */
export function create_element_mapping(options?: object): object {
    return create_element_or_mapping(options, true);
}

/** move the given node according to options
 *  @param {Object|undefined|null} options: {
 *      parent?: Node|null,  // parent node, null or undefined for none
 *      before?: Node|null,  // sibling node before which to insert; append if null or undefined
 *  }
 * parent and before cannot both be null/undefined.
 */
export function move_node(node: Node, options: { parent?: any, before?: any }): void {
    if (!(node instanceof Node)) {
        throw new Error('node must be an instance of Node');
    }
    const {
        parent,
        before,
    } = validate_parent_and_before_from_options(options);
    if (!parent) {
        throw new Error('options must specify either "parent" or "before"');
    }
    parent.insertBefore(node, before);
}

/** create_stylesheet_link(parent, stylesheet_url, attrs)
 *  @param {Element} parent
 *  @param {string} stylesheet_url
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {HTMLElement} the new <link> element
 */
export function create_stylesheet_link(parent: Element, stylesheet_url: URL|string, attrs?: object, permit_duplication: boolean = false): Element {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    attrs = attrs ?? {};
    if ('rel' in attrs || 'href' in attrs) {
        throw new Error('attrs must not contain "rel" or "href"');
    }
    let link_element;
    if (!permit_duplication) {
        // note that the duplication does not take into account attrs
        link_element = parent.querySelector(`link[rel="stylesheet"][href="${stylesheet_url.toString().replaceAll('"', '\\"')}"]`);
        // make sure link_element that was found is a direct child of parent
        if (link_element?.parentElement !== parent) {
            link_element = null;
        }
    }
    return link_element ?? create_element({
        parent,
        tag: 'link',
        attrs: {
            rel: "stylesheet",
            href: stylesheet_url.toString(),
            ...attrs,
        },
    });
}

/** create_inline_stylesheet(parent, stylesheet_text, attrs)
 *  @param {Element} parent
 *  @param {string} stylesheet_text
 *  @param {Object|undefined|null} attrs
 *  @return {HTMLStyleElement} the new <style> element
 */
export function create_inline_stylesheet(parent: Element, stylesheet_text: string, attrs?: object) {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    const style_el = create_element({
        tag: 'style',
        attrs,
    });
    style_el.appendChild(document.createTextNode(stylesheet_text));
    parent.appendChild(style_el);
    return style_el;
}

/** create_script(parent, script_url, attrs=null, permit_duplication=false)
 *  @param {Element} parent
 *  @param {string} script_url
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {HTMLStyleElement} the new <style> element
 */
export function create_script(parent: Element, script_url: URL|string, attrs?: object, permit_duplication: boolean = false): Element {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    attrs = attrs ?? {};
    if ('src' in attrs) {
        throw new Error('attrs must not contain "src"');
    }
    let script_element;
    if (!permit_duplication) {
        // note that the duplication does not take into account attrs
        script_element = parent.querySelector(`script[src="${script_url.toString().replaceAll('"', '\\"')}"]`);
        // make sure script_element that was found is a direct child of parent
        if (script_element?.parentElement !== parent) {
            script_element = null;
        }
    }
    return script_element ?? create_element({
        parent,
        tag: 'script',
        attrs: {
            src: script_url,
            ...attrs,
        },
    });
}

/** create_inline_script(parent, script_text, attrs)
 *  @param {Element} parent
 *  @param {string} script_text
 *  @param {Object|undefined|null} attrs
 *  @return {HTMLScriptElement} the new <script> element
 */
export function create_inline_script(parent: Element, script_text: string, attrs?: object): Element {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    if (attrs && 'src' in attrs) {
        throw new Error('attrs must not contain "src"');
    }
    const script_el = create_element({
        tag: 'script',
        attrs,
    });
    script_el.appendChild(document.createTextNode(script_text));
    parent.appendChild(script_el);
    return script_el;
}


// === SCRIPT LOADING ===

export type EstablishScriptPromiseData = {
    promise?: Promise<void>;
    resolve?: { (): void };
    reject?:  { (error: any): void };
};

const _script_promise_data = new Map<string, EstablishScriptPromiseData>;

// _establish_script_promise_data(script_url) returns
// { promise_data, initial } where promise_data is
// _script_promise_data.get(script_url) and initial is true
// iff the promise was newly created.
function _establish_script_promise_data(full_script_url: URL|string): { initial: boolean, promise_data: EstablishScriptPromiseData } {
    const data_key = full_script_url.toString();
    let promise_data = _script_promise_data.get(data_key);
    let initial;
    if (promise_data) {
        initial = false;
    } else {
        promise_data = {};
        promise_data.promise = new Promise((resolve, reject) => {
            if (promise_data) {
                promise_data.resolve = resolve;
                promise_data.reject  = reject;
            }
        });
        _script_promise_data.set(data_key, promise_data);
        initial = true;
    }
    return { initial, promise_data };
}

/** async function load_script(parent, script_url, attrs=null, permit_duplication=false)
 *  @param {Node} parent the parent element for script
 *  @param {string} script_url url of script to load (the script tag will be created without defer or async attributes)
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {Promise}
 *  Use this to load a script and wait for its 'load' event.
 *  Only the first invokation for a particular script_url will create
 *  the script element.  Others will simply wait for the script to load
 *  or for error.
 */
export async function load_script(parent: Element, script_url: URL|string, attrs?: object, permit_duplication: boolean = false): Promise<void> {
    const full_script_url = new URL(script_url, assets_server_url(current_script_url));//!!! correct to make relative to current_script_url
    const { promise_data, initial } = _establish_script_promise_data(full_script_url);
    if (initial) {
        let script_el: undefined|Element;
        function script_load_handler(event: Event) {
            promise_data.resolve?.();
            reset();
        }
        function script_load_error_handler(event: Event) {
            promise_data.reject?.(new Error(`error loading script ${full_script_url}`));
            reset();
        }
        function reset() {
            if (script_el) {
                script_el.removeEventListener('load',  script_load_handler);
                script_el.removeEventListener('error', script_load_error_handler);
            }
            promise_data.resolve = undefined;
            promise_data.reject  = undefined;
        }
        try {
            script_el = create_script(parent, full_script_url, attrs, permit_duplication);
            script_el.addEventListener('load',  script_load_handler,       { once: true });
            script_el.addEventListener('error', script_load_error_handler, { once: true });
        } catch (err) {
            promise_data.reject?.(err);
            reset();
        }
    }
    return promise_data.promise;
}

/** async function load_script_and_wait_for_condition(parent, script_url, condition_poll_fn, attrs=null, permit_duplication=false)
 *  @param {Node} parent the parent element for script
 *  @param {string} script_url url of script to load (the script tag will be created without defer or async attributes)
 *  @param {() => boolean} condition_poll_fn function that will return true when script has loaded
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {Promise}
 *  Use this to load a script where you want to poll for condition
 *  that will be triggered asynchronously by the script, in which
 *  case waiting for the load event will not work because it fires
 *  when script execution completes but not when some later condition
 *  is triggered asynchronously by the script.
 *  Only the first invokation for a particular script_url will create
 *  the script element.  Others will simply wait for the script to load
 *  or for error.
 */
export async function load_script_and_wait_for_condition(
    parent:             Element,
    script_url:         URL|string,
    condition_poll_fn:  () => any,
    attrs?:             object,
    permit_duplication: boolean = false ): Promise<void> {
    const full_script_url = new URL(script_url, assets_server_url(current_script_url));//!!! correct to make relative to current_script_url
    const { promise_data, initial } = _establish_script_promise_data(full_script_url);
    if (initial) {
        let script_el:     undefined|Element;
        let wait_timer_id: undefined|number;
        function script_load_error_handler(event: Event) {
            promise_data.reject?.(new Error(`error loading script ${full_script_url}`));
            reset();
        }
        function wait(): void {
            if (condition_poll_fn()) {
                promise_data.resolve?.();
                reset();
            } else {
                wait_timer_id = setTimeout(wait) as unknown as number;  // check again on next tick
            }
        }
        function reset() {
            if (typeof wait_timer_id !== 'undefined') {
                clearTimeout(wait_timer_id);
                wait_timer_id = undefined;
            }
            if (script_el) {
                script_el.removeEventListener('error', script_load_error_handler);
            }
            promise_data.resolve = undefined;
            promise_data.reject  = undefined;
        }
        try {
            script_el = create_script(parent, full_script_url, attrs, permit_duplication);
            script_el.addEventListener('error', script_load_error_handler, { once: true });
            wait();
        } catch (err) {
            promise_data.reject?.(err);
            reset();
        }
    }
    return promise_data.promise;
}


// === NODE OFFSET IN PARENT ===

export function find_child_offset(child: Node) {
    const parent_child_nodes = child?.parentNode?.childNodes;
    if (!parent_child_nodes) {
        return undefined;
    } else {
        return Array.prototype.indexOf.call(parent_child_nodes, child);
    }
}
