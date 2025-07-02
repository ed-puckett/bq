import {
    RendererFactory,
    is_RendererFactory,
    TextBasedRenderer,
} from './renderer';


export type ExtensionManagerMappedInfo = {
    factory: RendererFactory,
    shadows: RendererFactory[],
};


export class ExtensionManager {
    get CLASS (){ return this.constructor as typeof ExtensionManager; }

    clear() {
        this.#type_to_factory_info_map = new Map<string, ExtensionManagerMappedInfo>();
    }

    #type_to_factory_info_map = new Map<string, ExtensionManagerMappedInfo>();

    // Note: each entry of this.#type_to_factory_info_map refers to an "info"
    // object that contains a "shadows" property which is in turn an array of
    // other factory that have been shadowed via the add() method.  Factories
    // will be shadowed when another factory is added with a type that is
    // already mapped.  When a factory is subsequently removed, the prior
    // mapping is restored.  This enables a protocol where a Factory is added
    // upon entry to some context, and then removed when the context is exited.
    // The shadows property should not be "optimized" to coalesce prior
    // shadowed factories when an added factory has already been shadowed
    // before -- this would break the ability to provide the mentioned protocol.

    static canonicalize_type(type: string) { return type.toLowerCase(); }

    get(type: string): undefined|RendererFactory {
        if (typeof type !== 'string' || type.length <= 0) {
            throw new TypeError('type must be a non-empty string');
        }
        const canonical_type = this.CLASS.canonicalize_type(type);
        const current_info = this.#type_to_factory_info_map.get(canonical_type);
        return current_info?.factory;
    }

    get_all(): RendererFactory[] {
        return [ ...this.#type_to_factory_info_map.values() ].map(({ factory }) => factory);
    }

    add(factory: RendererFactory): void {
        this.CLASS.#add_factory_to_map(factory, this.#type_to_factory_info_map);
    }

    static #add_factory_to_map(factory: RendererFactory, map: Map<string, ExtensionManagerMappedInfo>): void {
        if (!is_RendererFactory(factory) || factory.type.length <= 0) {
            throw new TypeError('factory must be a RendererFactory with a nonempty type string');
        }
        const canonical_type = this.canonicalize_type(factory.type);
        const current_info = map.get(canonical_type);
        const new_info = {
            factory,
            shadows: current_info
                ? [ ...current_info.shadows, current_info.factory ]  // insert new factory at beginning
                : [],
        };
        map.set(canonical_type, new_info);
    }

    remove(factory: RendererFactory): void {
        if (!is_RendererFactory(factory) || factory.type.length <= 0) {
            throw new TypeError('factory must be a RendererFactory with a nonempty type string');
        }
        const canonical_type = this.CLASS.canonicalize_type(factory.type);
        const current_info = this.#type_to_factory_info_map.get(canonical_type);
        if (!current_info || current_info.factory !== factory) {
            throw new Error(`factory is not currently managed by this ExtensionManager`);
        }
        if (current_info.shadows.length <= 0) {
            // no shadowed factories left...
            this.#type_to_factory_info_map.delete(canonical_type);
        } else {
            // restore prior mapping
            const new_info = {
                factory: current_info.shadows[0],
                shadows: current_info.shadows.slice(1),
            };
            this.#type_to_factory_info_map.set(canonical_type, new_info);
        }
    }

    reset(initial_factories?: RendererFactory[]) {
        if (typeof initial_factories !== 'undefined' && !(Array.isArray(initial_factories) && initial_factories.every(item => is_RendererFactory(item)))) {
            throw new TypeError('initial_factories must be undefined or an array of RendererFactory');
        }

        const new_map = new Map<string, ExtensionManagerMappedInfo>();
        if (initial_factories) {
            for (const factory of initial_factories) {
                this.CLASS.#add_factory_to_map(factory, new_map);
            }
        }
        this.#type_to_factory_info_map = new_map;  // make changes atomically
    }
}
