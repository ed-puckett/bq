import {
    RendererFactory,
    is_RendererFactory,
    TextBasedRenderer,
} from './renderer';


// === TEXT-BASED RENDERER FACTORY COLLECTION (INITIALIZED BELOW) ===

// used by TextBasedRenderer extensions to self-register
export const _initial_text_renderer_factories: RendererFactory[] = [];

let text_renderer_factories: Array<RendererFactory>;  // Array of TextBasedRenderer factories, priority order, all with unique type properties
let type_to_text_renderer_factory_map: Map<string, RendererFactory>;  // Map type->TextBasedRenderer factory, derived from current text renderer factories


// === TEXT-BASED RENDERER COLLECTION ACCESS/UPDATE ===

export function text_renderer_factory_for_type(type: string): undefined|RendererFactory {
    const renderer_factory = type_to_text_renderer_factory_map.get(type.toLowerCase());
    return renderer_factory ? renderer_factory : undefined;
}

export function get_text_renderer_factories(): RendererFactory[] {
    return [ ...text_renderer_factories ];
}

/** set a new collection of TextBasedRenderer instances
 *  @param {TextBasedRenderer[]} new_renderer_factories an array of TextBasedRenderer instances
 * new_renderer_factories must not contain renderers with duplicated types
 */
export function set_text_renderer_factories(new_renderer_factories: RendererFactory[]): void {
    if (!Array.isArray(new_renderer_factories)) {
        throw new Error('new_renderer_factories must be an Array');
    }
    const types_seen = new Set();
    for (const rf of new_renderer_factories) {
        if (!is_RendererFactory(rf)) {
            throw new Error('new_renderer_factories must be an Array of RendererFactory objects');
        }
        if (types_seen.has(rf.type)) {
            throw new Error(`new_renderer_factories contains multiple entries with type "${rf.type}"`);
        }
        types_seen.add(rf.type);
    }
    // validation passed, establish new state
    text_renderer_factories = [ ...new_renderer_factories ];
    type_to_text_renderer_factory_map =
        new Map(
            text_renderer_factories.map(renderer => {
                return [ renderer.type, renderer ];
            })
        );
}

export function reset_to_initial_text_renderer_factories(): void {  // called in initialization below
    set_text_renderer_factories(_initial_text_renderer_factories);
}

export function add_text_renderer_factory(renderer_factory: RendererFactory): void {
    if (!is_RendererFactory(renderer_factory)) {
        throw new Error('renderer_factory must be an instance of RendererFactory');
    }
    const new_renderer_factories = [
        renderer_factory,
        ...text_renderer_factories.filter(rf => rf.type !== renderer_factory.type),
    ];
    set_text_renderer_factories(new_renderer_factories);
}

export function remove_text_renderer_factory(renderer_factory: RendererFactory): void {
    const new_renderer_factories = text_renderer_factories.filter(rf => rf.type !== renderer_factory.type);
    set_text_renderer_factories(new_renderer_factories);
}


// === INITIALIZATION ===

// When this is called, _initial_text_renderer_factories will still be empty.
// Go ahead and do it anyway....
// This is called again in src/init.ts during document initialization and
// at that point there are actual entries in _initial_text_renderer_factories.
reset_to_initial_text_renderer_factories();
