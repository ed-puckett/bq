export type ListenerSpec = {
    target:   EventTarget;
    type:     string;
    listener: EventListenerOrEventListenerObject;
    options:  boolean | AddEventListenerOptions;
}

export class EventListenerManager {
    #specs:    Array<ListenerSpec>;
    #attached: boolean;  // true iff event the handlers have been attached

    constructor(attached: boolean = false) {
        this.#specs    = [];
        this.#attached = attached;
    }

    get empty    (){ return this.#specs.length <= 0; }
    get attached (){ return this.#attached; }

    add( target:   EventTarget,
         type:     string,
         listener: EventListenerOrEventListenerObject,
         options:  boolean | AddEventListenerOptions = {} ): void {
        //!!! options is not copied, and yet is used later
        //!!! could use structuredClone(), but would that prevent remove() from finding?
        const spec = { target, type, listener, options };
        EventListenerManager.#validate_spec(spec);
        if (this.#first_spec_index_of(spec) !== -1) {
            throw new Error('equivalent event handler already added');
        }
        if (this.#attached) {
            target.addEventListener(type, listener, options);
        }
        this.#specs.push(spec);
    }

    remove( target:   EventTarget,
            type:     string,
            listener: EventListenerOrEventListenerObject,
            options:  boolean | AddEventListenerOptions = {} ): void {
        const spec = { target, type, listener, options };
        EventListenerManager.#validate_spec(spec);
        const index = this.#first_spec_index_of(spec);
        if (index === -1) {
            throw new Error('specified event handler not found');
        }
        this.#specs.splice(index, 1);
        if (this.#attached) {
            target.removeEventListener(type, listener, options);
        }
    }

    remove_all(): void {
        if (this.#attached) {
            for (const spec of this.#specs) {
                const { target, type, listener, options } = spec;
                target.removeEventListener(type, listener, options);
            }
        }
        this.#specs.splice(0);  // remove all entries
    }

    attach(): void {
        if (!this.#attached) {
            for (const spec of this.#specs) {
                const { target, type, listener, options } = spec;
                target.addEventListener(type, listener, options);
            }
            this.#attached = true;
        }
    }

    detach(): void {
        if (this.#attached) {
            for (const spec of this.#specs) {
                const { target, type, listener, options } = spec;
                target.removeEventListener(type, listener, options);
            }
            this.#attached = false;
        }
    }


    // === INTERNAL ===

    // returns -1 if not found, otherwise a positive integer
    #first_spec_index_of(search_spec: ListenerSpec): number {
        for (let i = 0; i < this.#specs.length; i++) {
            const spec = this.#specs[i];
            if (spec && EventListenerManager.#same_specs(search_spec, spec)) {
                return i;
            }
        }
        return -1;
    }

    // returns true iff spec is for a listener that uses "capture"
    static #validate_spec(spec: ListenerSpec): boolean {
        if (typeof spec !== 'object') {
            throw new Error('spec must be an object');
        }
        let uses_capture: boolean = false;
        const { target, type, listener, options } = spec;
        if (!(target instanceof EventTarget)) {
            throw new Error('target must be an instance of EventTarget');
        }
        if (typeof type !== 'string') {
            throw new Error('type in spec must be a string');
        }
        if (typeof listener !== 'function') {
            throw new Error('listener in spec must be a function');
        }
        // removeEventListener() only pays attention to the "capture" effect
        // of a handler when determining which handler to remove.
        if (typeof options === 'boolean') {
            uses_capture = options;
        } else if (typeof options === 'object') {
            uses_capture = !!options.capture;
        } else if (typeof options !== 'undefined') {
            throw new Error('options in spec must be a undefined, boolean, or an object');
        }
        return uses_capture;
    }

    // return truthy iff spec1 and spec2 are the same for the purposes of removal
    static #same_specs( spec1: ListenerSpec,
                        spec2: ListenerSpec ): boolean {
        const uses_capture1 = this.#validate_spec(spec1);
        const uses_capture2 = this.#validate_spec(spec2);
        if (uses_capture1 !== uses_capture2) {
            return false;
        } else {
            return (spec1.target === spec2.target && spec1.type === spec2.type && spec1.listener === spec2.listener);
        }
        //!!! should other members of options be checked (e.g., "once")?
    }
}
