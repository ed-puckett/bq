import {
    EventListenerManager,
} from 'lib/sys/event-listener-manager';

import {
    SerialDataSource,
    Subscription,
} from 'lib/sys/serial-data-source';

import {
    beep,
} from 'lib/ui/beep';

import {
    KeySpec,
} from './key-spec';

import {
    KeyMap,
    KeyMapMapper,
} from './key-map';


export type CommandContext<DocumentManager> = {
    dm:        DocumentManager,
    command:   string,
    event?:    null|Event,
    target?:   null|EventTarget,
    key_spec?: null|KeySpec,
};

export class KeyEventManager<DocumentManager> {
    #dm:               DocumentManager;
    #event_target:     EventTarget;
    #command_observer: ((cc: CommandContext<DocumentManager>) => void);
    #commands:         SerialDataSource<CommandContext<DocumentManager>>;

    get dm               (){ return this.#dm; }
    get event_target     (){ return this.#event_target; }
    get command_observer (){ return this.#command_observer; }
    get commands         (){ return this.#commands; }

    #event_listener_manager: EventListenerManager;
    #commands_subscription:  Subscription;
    #key_map_stack:          Array<KeyMap>;
    #key_mapper:             null|KeyMapMapper;                       // set iff attached
    #key_handler:            undefined|((e: KeyboardEvent) => void);  // set iff attached

    /** KeyEventManager constructor
     *  @param {EventTarget} event_target the source of events
     *  @param {Function} command_observer function to handle command events
     */
    constructor(dm: DocumentManager, event_target: EventTarget, command_observer: ((cc: CommandContext<DocumentManager>) => void)) {
        this.#dm               = dm;
        this.#event_target     = event_target;
        this.#command_observer = command_observer;

        this.#event_listener_manager = new EventListenerManager();

        this.#commands = new SerialDataSource<CommandContext<DocumentManager>>();
        this.#commands_subscription = this.commands.subscribe(command_observer);  //!!! note: never unsubscribed

        this.#key_map_stack = [];    // stack grows from the front, i.e., the first item is the last pushed
        this.#key_mapper    = null;  // set iff attached
    }

    reset_key_map_stack(): void {
        if (this.#key_map_stack.length > 0) {
            this.#key_map_stack.splice(0);  // clear stack
            this.#rebuild();
        }
    }
    push_key_map(key_map: KeyMap): void {
        if (!(key_map instanceof KeyMap)) {
            throw new Error('key_map must be an instance of KeyMap');
        }
        if (this.#key_map_stack.indexOf(key_map) !== -1) {
            throw new Error('key_map already exists in stack');
        }
        this.#key_map_stack.unshift(key_map);
        this.#rebuild();
    }
    pop_key_map(): undefined|KeyMap {
        const popped_key_map = this.#key_map_stack.shift();
        if (popped_key_map) {
            this.#rebuild();
        }
        return popped_key_map;
    }
    remove_key_map( key_map: KeyMap,
                    remove_subsequent_too: boolean = false): boolean {
        const index = this.#key_map_stack.indexOf(key_map);
        if (index === -1) {
            return false;
        } else {
            if (remove_subsequent_too) {
                this.#key_map_stack.splice(0, index+1);  // delete this and newer items
            } else {
                this.#key_map_stack.splice(index, 1);  // delete only this item
            }
            this.#rebuild();
            return true;
        }
    }

    get is_attached (){ return !!this.#key_mapper; }  // this.#key_mapper set iff attached

    /** attach to event_target and start listening for events.
     *  @return {Boolean} true iff successful
     */
    attach(): boolean {
        if (this.is_attached) {
            throw new Error('attach() called when already attached');
        }
        // not attached: this.#key_mapper is null

        if (this.#key_map_stack.length <= 0) {
            return false;  // indicate: attach failed
        }

        const initial_state = KeyMap.multi_mapper(...this.#key_map_stack);
        this.#key_mapper = initial_state;

        let state:           KeyMapMapper;    // current "location" in key mapper
        let key_sequence:    Array<KeySpec>;  // current sequence of key_specs that have been seen

        function reset() {
            state = initial_state;
            key_sequence = [];
        }
        reset();

        const blur_handler = reset;  // attached to this.event_target

        const key_handler = (event: KeyboardEvent) => {  // attached to this.event_target
            switch (event.key) {
                case 'Alt':
                case 'AltGraph':
                case 'CapsLock':
                case 'Control':
                case 'Fn':
                case 'FnLock':
                case 'Hyper':
                case 'Meta':
                case 'NumLock':
                case 'ScrollLock':
                case 'Shift':
                case 'Super':
                case 'Symbol':
                case 'SymbolLock':
                case 'OS':  // Firefox quirk
                    // modifier key, ignore
                    break;

                default: {
                    const key_spec = KeySpec.from_keyboard_event(event);
                    key_sequence?.push(key_spec);
                    const mapping_result = state.consume(key_spec);
                    if (!mapping_result) {
                        // failed
                        if (state !== initial_state) {
                            // beep only if at least one keypress has already been accepted
                            event.preventDefault();
                            event.stopPropagation();
                            beep();
                        }
                        // if still in initial_state, then no event.preventDefault()
                        reset();
                    } else {
                        event.preventDefault();
                        event.stopPropagation();
                        if (typeof mapping_result === 'string') {
                            const command = mapping_result;
                            const command_context: CommandContext<DocumentManager> = {
                                dm:      this.dm,
                                command,
                                event,
                                target:  event.target,
                                key_spec,
                            };
                            this.commands.dispatch(command_context);
                            reset();
                        } else {
                            state = mapping_result;
                        }
                    }
                    break;
                }
            }
        };

        this.#key_handler = key_handler;  // for inject_key_event()

        this.#event_listener_manager.remove_all();  // prepare to re-add below
        const listener_specs: [ EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions ][] = [
            [ this.event_target, 'blur',    blur_handler as EventListener, { capture: true } ],
            [ this.event_target, 'keydown', key_handler  as EventListener, { capture: true } ],
        ];
        for (const [ target, type, listener, options ] of listener_specs) {
            this.#event_listener_manager.add(target, type, listener, options);
        }
        this.#event_listener_manager.attach();

        return true;  // indicate: successfully attached
    }

    /** detach from event_target and stop listening for events.
     *  no-op if called when this.#event_listener_manager is already empty.
     */
    detach(): void {
        this.#event_listener_manager.remove_all();
        this.#key_mapper  = null;
        this.#key_handler = undefined;
    }

    inject_key_event(key_event: KeyboardEvent): void {
        this.#key_handler?.(key_event);
    }


    // === INTERNAL ===

    #rebuild(): void {
        // rebuild the event handlers and state machine.
        const was_attached = this.is_attached;
        this.detach();
        if (was_attached) {
            this.attach();  // will fail if key_map stack is empty
        }
    }
}
