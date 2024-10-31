import {
    KeySpec,
} from './key-spec';


export type KeyMapBindings = {
    [command: string]: string[];
};

export type KeyMapRecognizer = (key_spec: KeySpec) => false|string;

export type KeyMapMapping = {
    [canonical_key_string: string]: string|KeyMapMapping;
};


export class KeyMap {
    readonly bindings:   null|KeyMapBindings;
    readonly recognizer: null|KeyMapRecognizer;
    readonly mapping:    KeyMapMapping;

    constructor( bindings:   null|KeyMapBindings   = null,
                 recognizer: null|KeyMapRecognizer = null ) {
        this.bindings   = bindings;
        this.recognizer = recognizer;
        this.mapping    = KeyMap.#create_mapping(bindings);
    }

    create_mapper(fallback_mapper: null|KeyMapMapper = null): KeyMapMapper {
        return new KeyMapMapper(this.mapping, this.recognizer, fallback_mapper);
    }

    static multi_mapper(...key_maps: KeyMap[]): KeyMapMapper {
        if (key_maps.length <= 0) {
            throw new Error('at least one KeyMap instance must be given');
        }
        if (!key_maps.every(m => m instanceof this)) {
            throw new Error('arguments must all be KeyMap instances');
        }
        return key_maps.reduce<KeyMapMapper>(
            (mapper, key_map) => key_map.create_mapper(mapper),
            null as unknown as KeyMapMapper
        );
    }

    static #create_mapping(bindings: null|KeyMapBindings): KeyMapMapping {
        if (bindings !== null && typeof bindings !== 'object') {
            throw new Error('bindings must be null or an object');
        }
        const mapping: KeyMapMapping = {};
        if (bindings) {
            for (const command in bindings) {
                if (command.length <= 0) {
                    throw new Error('bindings keys (command names) must not be empty strings');
                }
                const command_bindings = bindings[command];
                if (command_bindings) {
                    for (const key_sequence of command_bindings) {
                        let seq_mapping: KeyMapMapping = mapping;  // current mapping being acted upon by current key_string of sequence
                        const seq_key_strings = key_sequence.split(KeySpec.canonical_key_string_separator);
                        for (let i = 0; i < seq_key_strings.length; i++) {
                            const key_string = seq_key_strings[i];
                            const is_last = (i >= seq_key_strings.length-1);
                            const canonical_key_string = new KeySpec(key_string).canonical;
                            const existing = seq_mapping[canonical_key_string];
                            if (typeof existing === 'string' || (typeof existing === 'object' && is_last)) {
                                // something else already mapped here...
                                const seq_so_far = seq_key_strings.slice(0, i+1).join(KeySpec.canonical_key_string_separator);
                                throw new Error(`duplicate bindings specified for key sequence: ${seq_so_far}`);
                            }
                            if (!is_last) {
                                // multi-key sequence
                                // use existing if not null or undefined, otherwise create a sub-mapping
                                seq_mapping = existing ?? (seq_mapping[canonical_key_string] = {});
                            } else {
                                seq_mapping[canonical_key_string] = command;  // and then we're done...
                            }
                        }
                    }
                }
            }
        }
        return mapping;
    }
}


export class KeyMapMapper {
    readonly mapping:         KeyMapMapping;
    readonly recognizer:      null|KeyMapRecognizer;
    readonly fallback_mapper: null|KeyMapMapper;

    constructor( mapping:         KeyMapMapping,
                 recognizer:      null|KeyMapRecognizer,
                 fallback_mapper: null|KeyMapMapper = null) {
        if (mapping !== null && typeof mapping !== 'undefined' && typeof mapping !== 'object') {
            throw new Error('mapping must be null/undefined or an object');
        }
        if (recognizer !== null && typeof recognizer !== 'undefined' && typeof recognizer !== 'function') {
            throw new Error('recognizer must be null/undefined or a function');
        }
        if (fallback_mapper !== null && typeof fallback_mapper !== 'undefined' && !(fallback_mapper instanceof KeyMapMapper)) {
            throw new Error('fallback_mapper must be null/undefined or a KeyMap instance');
        }
        if (!mapping && !fallback_mapper) {
            throw new Error('at least one of mapping or fallback_mapper must be given');
        }
        this.mapping         = mapping;
        this.recognizer      = recognizer;
        this.fallback_mapper = fallback_mapper;
    }

    // returns a command string (complete), or undefined (failed), or a new Mapper instance (waiting for next key in sequence)
    consume(key_string_or_key_spec: string|KeySpec): string|undefined|KeyMapMapper {
        const key_spec = (key_string_or_key_spec instanceof KeySpec)
            ? key_string_or_key_spec
            : new KeySpec(key_string_or_key_spec);
        const recognizer_result = this.recognizer?.(key_spec);
        // this.recognizer takes precedence over this.mapping
        if (typeof recognizer_result === 'string') {
            return recognizer_result;
        }
        // this.mapping takes precedence over this.fallback_mapper
        const canonical_key_string = key_spec.canonical;
        const mapping_result = this.mapping?.[canonical_key_string];  // returns: undefined, string, or another mapping (object)
        if (typeof mapping_result === 'string') {
            return mapping_result;
        }
        const fallback_mapper_result = this.fallback_mapper?.consume(key_spec);
        if (typeof fallback_mapper_result === 'string') {
            return fallback_mapper_result;
        }
        if (!mapping_result && !fallback_mapper_result) {
            return undefined;  // indicate: failed
        }
        return mapping_result
            ? new KeyMapMapper(mapping_result, null, fallback_mapper_result)
            : fallback_mapper_result;  // no need to compose with mapping_result (which is undefined)
    }
}
