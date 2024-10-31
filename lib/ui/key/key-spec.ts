type ModifierDesc = {
    code:          string;
    event_prop:    string;
    glyph:         string;
    display_order: number;
    alternates:    string[];
};

type ExtendedModifierDesc = ModifierDesc & {
    modifier:       string;
    basic_modifier: string;
};


export class KeySpec {
    readonly key_string: string;
    readonly context:    any;

    readonly key:                 string;
    readonly modifiers:           string[];
    readonly modifier_descs:      ModifierDesc[];
    readonly modifier_flags:      number;
    readonly canonical_modifiers: string;
    readonly canonical:           string;
    readonly is_printable:        boolean;

    // there must be one of these for each corresponding entry in KeySpec.#basic_modifier_desc_map
    readonly has_meta:  boolean;
    readonly has_ctrl:  boolean;
    readonly has_shift: boolean;
    readonly has_alt:   boolean;

    // there must be one of these for each corresponding entry in KeySpec.#basic_modifier_desc_map
    //!!! can't make these readonly....
    static meta_flag:  number;
    static ctrl_flag:  number;
    static shift_flag: number;
    static alt_flag:   number;


    constructor(key_string: string, context: any = null) {
        if (typeof key_string !== 'string' || key_string.length <= 0) {
            throw new Error('key_string must be a non-empty string');
        }
        this.key_string = key_string;
        this.context    = context;

        const modifiers = this.key_string.split(/[+-]/);
        if (modifiers.length < 1 || modifiers.some(s => s.length <= 0)) {
            // check for case where key is '+' or '-', e.g., "-" or "shift++":
            if (this.key_string.match(/^[+-]$/)) {  // + or - alone?
                modifiers.splice(0);  // remove all entries
                modifiers.push(this.key_string);  // then add back this.key_string
            } else if (this.key_string.match(/[+-][+-]$/)) {  // with modifier?
                // remove last (empty) string:
                modifiers.splice(-1);
                // change new last (empty) string to the '+' or '-' that was specified:
                modifiers[modifiers.length-1] = this.key_string[this.key_string.length-1];
            } else {
                throw new Error(`invalid key_string ${this.key_string}`);
            }
        }
        let key = modifiers.at(-1) ?? '';  // note: not converted to lowercase
        modifiers.splice(-1);  // remove key from modifiers
        for (let i = 0; i < modifiers.length; i++) {
            modifiers[i] = modifiers[i].toLowerCase();
        }
        let klc = key.toLowerCase();
        if (['up', 'down', 'left', 'right'].includes(klc)) {
            key = `Arrow${key}`;
            klc = `arrow${klc}`;
        }
        const modifier_descs = [];
        for (const modifier of modifiers) {
            const desc = KeySpec.#key_string_modifier_to_desc(modifier);
            if (!desc) {
                throw new Error(`invalid modifier "${modifier}" in key_string ${this.key_string}`);
            }
            if (desc.code in modifier_descs) {//!!! incorrect comparison
                throw new Error(`redundant modifier "${modifier}" in key_string ${this.key_string}`);
            }
            modifier_descs.push(desc);
        }
        modifier_descs.sort((a, b) => (a.display_order - b.display_order));  // sort in-place
        const modifier_flags = Object.values(modifier_descs)
              .reduce<number>((flags, desc) => (flags | KeySpec.#modifier_to_flag[desc.code]), 0);
        const canonical_modifiers = modifier_descs
              .map(desc => desc.code)
              .join('');
        // determine is_printable
        let is_printable = true;
        if ((modifier_flags & ~KeySpec.shift_flag) !== 0) {
            // not printable if any modifier other than shift is applied
            is_printable = false;
        } else {
            // \p{C}: see https://unicode.org/reports/tr18/#General_Category_Property ("Control" characters)
            is_printable = !(key.length !== 1 || key.match(/^[\p{C}]$/u));
        }
        // note: preserve alphabetic case if is_printable, otherwise use lower-cased key
        const canonical = `${canonical_modifiers}${KeySpec.canonical_key_modifier_separator}${is_printable ? key : klc}`;

        Object.freeze(modifiers);
//!!!        Object.freeze(modifier_descs);

        this.key                 = key;
        this.modifiers           = modifiers;
        this.modifier_descs      = modifier_descs;
        this.modifier_flags      = modifier_flags;
        this.canonical_modifiers = canonical_modifiers;
        this.canonical           = canonical;
        this.is_printable        = is_printable;

        // there must be one of these for each corresponding entry in KeySpec.#basic_modifier_desc_map
        this.has_meta  = this.modifiers.includes('meta');
        this.has_ctrl  = this.modifiers.includes('ctrl');
        this.has_shift = this.modifiers.includes('shift');
        this.has_alt   = this.modifiers.includes('alt');
    }


    // === CONSTANTS ===

    static canonical_key_modifier_separator = '+';  // separator between modifier codes and key in a canonical key string
    static canonical_key_string_separator   = ' ';  // separator between key_strings in a canonical key binding

    // #basic_modifier_desc_map is the definition from which #modifier_desc_map and #modifier_code_desc_map are derived
    static #basic_modifier_desc_map: { [modifier: string]: ModifierDesc } = {
        meta:  { code: 'm', event_prop: 'metaKey',  glyph: '\u2318', display_order: 3, alternates: [ 'cmd', 'command' ] },
        ctrl:  { code: 'c', event_prop: 'ctrlKey',  glyph: '\u2303', display_order: 1, alternates: [ 'control' ] },
        shift: { code: 's', event_prop: 'shiftKey', glyph: '\u21E7', display_order: 2, alternates: [] },
        alt:   { code: 'a', event_prop: 'altKey',   glyph: '\u2325', display_order: 4, alternates: [] },
    };

    static #other_key_glyphs: { [key: string]: string } = {
        arrowleft:  '\u2190',
        arrowup:    '\u2191',
        arrowright: '\u2192',
        arrowdown:  '\u2193',
        enter:      'Enter',
        backspace:  'Backspace',
        delete:     'Delete',
    };


    // === PARSING ===

    static from_keyboard_event(keyboard_event: KeyboardEvent) {
        const modifier_descs: ModifierDesc[] = [];
        for (const modifier in this.#basic_modifier_desc_map) {
            const desc = this.#basic_modifier_desc_map[modifier];
            // omg typescript calisthenics...
            if ((keyboard_event as unknown as { [key: string]: boolean })[desc.event_prop]) {
                modifier_descs.push(desc);
            }
        }
        const modifier_strings = modifier_descs
              .map(desc => this.#modifier_code_to_modifier[desc.code]);
        let key = keyboard_event.key;
        const key_string = [ ...modifier_strings, key ].join(this.canonical_key_modifier_separator);
        // attaching keyboard_event as context enables commands like "insert-self"
        return new this(key_string, keyboard_event);
    }

    get glyphs (): string {
        if (typeof this.#glyphs === 'undefined') {
            // cache result
            const key = this.key;
            const klc = key.toLowerCase();
            const result_segments: string[] = this.modifier_descs.map((desc: ModifierDesc) => desc.glyph);
            if (klc in KeySpec.#other_key_glyphs) {
                result_segments.push(KeySpec.#other_key_glyphs[klc]);
            } else if (key.match(/^[a-zA-Z]$/) || key.match(/^[fF][0-9]{1,2}$/)) {
                result_segments.push(key.toUpperCase());
            } else {
                result_segments.push(key);
            }
            this.#glyphs = result_segments.join('');
        }
        return this.#glyphs;
    }
    #glyphs: undefined|string;  // memoization


    // === INTERNAL ===

    // modifier_desc: {
    //     modifier:       string,  // modifier string
    //     basic_modifier: string,  // canonical modifier string
    //     code:           string,  // canonical code for modifier
    //     event_prop:     string,  // corresponding property in KeyboardEvent object
    //     alternates:     string,  // all alternates, including basic_modifier
    // }
    static #modifier_desc_map:      { [modifier_key:  string]: ExtendedModifierDesc };  // initialized in this._init_static()
    static #modifier_code_desc_map: { [modifier_code: string]: ExtendedModifierDesc };  // initialized in this._init_static()

    static #is_on_macos: undefined|boolean;  // initialized in this._init_static()

    static #key_string_modifier_to_desc(modifier: string) {
        modifier = modifier.toLowerCase();
        if (['cmdorctrl', 'commandorctrl'].includes(modifier)) {
            const CmdOrCtrl = this.#is_on_macos ? 'meta' : 'ctrl';
            modifier = CmdOrCtrl.toLowerCase();
        }
        return this.#modifier_desc_map[modifier];
    }

    static #modifier_code_to_modifier:      { [code: string]: string };  // initialized in _init_static()
    static #modifier_code_to_glyph:         { [code: string]: string };  // initialized in _init_static()
    static #modifier_code_to_display_order: { [code: string]: number };  // initialized in _init_static()

    static #modifier_to_flag: { [code_or_full: string]: number };  // (code|full)->bit_field_integer;  initialized in _init_static()

    static {
        KeySpec._init_static();  // initialize at creation of this class
    }
    static _init_static() {
        this.#is_on_macos = (
            (globalThis.navigator as any)?.['userAgentData']?.['platform'] ??
            (globalThis.navigator as any).navigator?.['platform'] ??
            ''
        ).toLowerCase().includes('mac');

        this.#modifier_code_to_modifier = {};  // code->modifier
        for (const modifier in this.#basic_modifier_desc_map) {
            const desc = this.#basic_modifier_desc_map[modifier];
            this.#modifier_code_to_modifier[desc.code] = modifier;
        }

        this.#modifier_code_to_glyph =  // code->glyph
            Object.fromEntries(
                Object.entries(this.#basic_modifier_desc_map)
                    .map(([modifier_key, { code, glyph }]) => [ code, glyph ])
            );

        this.#modifier_code_to_display_order =  // code->number
            Object.fromEntries(
                Object.entries(this.#basic_modifier_desc_map)
                    .map(([modifier_key, { code, display_order }]) => [ code, display_order ])
            );

        this.#modifier_desc_map = this.#build_modifier_desc_map();  // modifier_string->modifier_desc

        this.#modifier_code_desc_map =  // modifier_code->modifier_desc
            Object.freeze(
                Object.fromEntries(
                    Object.keys(this.#basic_modifier_desc_map)
                        .map(k => this.#modifier_desc_map[k])
                        .map(desc => [ desc.code, desc ])
                )
            );

        let current_bit = 1;
        this.#modifier_to_flag = {};  // (code|full)->bit_field_integer
        for (const modifier in this.#basic_modifier_desc_map) {
            const desc = this.#basic_modifier_desc_map[modifier];
            this.#modifier_to_flag[modifier]  = current_bit;
            this.#modifier_to_flag[desc.code] = current_bit;
            current_bit <<= 1;
        }
        Object.freeze(this.#modifier_to_flag);

        // there must be one of these for each corresponding entry in KeySpec.#basic_modifier_desc_map
        KeySpec.meta_flag  = this.#modifier_to_flag['meta'];
        KeySpec.ctrl_flag  = this.#modifier_to_flag['ctrl'];
        KeySpec.shift_flag = this.#modifier_to_flag['shift'];
        KeySpec.alt_flag   = this.#modifier_to_flag['alt'];
    }

    static #build_modifier_desc_map() {
        // validate this.#basic_modifier_desc_map:
        {
            const disallowed_modifier_codes = ('+-' + this.canonical_key_modifier_separator + this.canonical_key_string_separator);

            const keys = Object.keys(this.#basic_modifier_desc_map);
            if (keys.some(k => k !== k.toLowerCase())) {
                throw new Error('KeySpec.#basic_modifier_desc_map keys must be lowercase');
            }
            const all_alternates = keys.map(k => this.#basic_modifier_desc_map[k].alternates).reduce((acc, a) => [...acc, ...a]);
            if (all_alternates.some(k => k !== k.toLowerCase())) {
                throw new Error('KeySpec.#basic_modifier_desc_map alternates must be lowercase');
            }
            if (new Set([...keys, ...all_alternates]).size !== (keys.length + all_alternates.length)) {
                throw new Error('KeySpec.#basic_modifier_desc_map keys and alternates must all be distinct');
            }
            const codes = keys.map(k => this.#basic_modifier_desc_map[k].code);
            for (const code of codes) {
                if (code.length !== 1) {
                    throw new Error('KeySpec.#basic_modifier_desc_map codes must be single characters');
                }
                if (disallowed_modifier_codes.includes(code)) {
                    throw new Error(`KeySpec.#basic_modifier_desc_map codes are not allowed to be any of following: ${disallowed_modifier_codes}`);
                }
            }
            if (new Set(codes).size !== codes.length) {
                throw new Error('KeySpec.#basic_modifier_desc_map code values must be distinct');
            }
            const props = keys.map(k => this.#basic_modifier_desc_map[k].event_prop);
            if (new Set(props).size !== props.length) {
                throw new Error('KeySpec.#basic_modifier_desc_map event_prop values must be distinct');
            }
        }
        // validation passed; build the map
        const mdm: { [modifier: string]: ExtendedModifierDesc } = {};
        function create_extended_desc(basic_modifier_key: string, modifier_key: string, desc: ModifierDesc): ExtendedModifierDesc {
            const ext_desc = {
                modifier: modifier_key,
                basic_modifier: basic_modifier_key,
                ...desc,
                alternates: [ ...new Set([ basic_modifier_key, modifier_key, ...desc.alternates ]) ],
            };
            return Object.freeze(ext_desc);
        }
        for (const bmdm_key in this.#basic_modifier_desc_map) {
            const desc = this.#basic_modifier_desc_map[bmdm_key];
            mdm[bmdm_key] = create_extended_desc(bmdm_key, bmdm_key, desc);
            for (const alt_key of desc.alternates) {
                mdm[alt_key] = create_extended_desc(bmdm_key, alt_key, desc);
            }
        }
        return Object.freeze(mdm);
    }
}
