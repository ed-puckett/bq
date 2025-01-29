import {
    manage_abort_signal_action,
    AbortSignalActionControl,
} from 'lib/sys/abort-signal-action';

import {
    SerialDataSource,
    SerialDataSourceSubscription,
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

import {
    CommandContext,
} from 'lib/ui/command-context';


export type KeyEventManagerOptions<DocumentManager> = {
    command_observer?: ((cc: CommandContext<DocumentManager>) => void),  // function to handle command events (can also be added later through this.commands.subscribe())
    initial_key_maps?: Array<KeyMap>,  // initial key map stack (stack grows from the front, i.e., the first item is the last pushed)
    abort_signal?:     AbortSignal,    // abort signal (one-shot), 'abort' event causes permanent detach
};


export class KeyEventManager<DocumentManager> {
    get CLASS (){ return this.constructor as typeof KeyEventManager<DocumentManager>; }

    /** KeyEventManager constructor
     *  @param {DocumentManager} the document manager instance controlling this application
     *  @param {EventTarget} event_target the source of events
     *  @param {KeyEventManagerOptions<DocumentManager>} options: {
     *      command_observer?: ((cc: CommandContext<DocumentManager>) => void),
     *      initial_key_maps?: Array<KeyMap>,
     *      abort_signal?:     AbortSignal,
     *  }
     *  Note: observers added later via this.commands.subscribe() will not be
     *  detached when abort_signal fires unless you pass in this.abort_signal
     *  in options to this.commands.subscribe().
     */
    constructor(dm: DocumentManager, event_target: EventTarget, options?: KeyEventManagerOptions<DocumentManager>) {
        const {
            command_observer,
            initial_key_maps,
            abort_signal,
        } = (options ?? {} as KeyEventManagerOptions<DocumentManager>)

        this.#dm               = dm;
        this.#event_target     = event_target;
        this.#command_observer = command_observer;
        this.#abort_signal     = abort_signal;

        this.#commands = new SerialDataSource<CommandContext<DocumentManager>>();
        if (command_observer) {
            this.commands.subscribe(command_observer, {
                abort_signal: this.#abort_signal,
            });
        }

        // stack grows from the front, i.e., the first item is the last pushed
        this.#key_map_stack = initial_key_maps ? Array.from(initial_key_maps) : [];  // copy initial_key_maps if given

        // finish initialization
        this.#key_mapper = null;  // set iff attached (will be set by this.#rebuild())
        this.#rebuild();
    }

    #dm:               DocumentManager;
    #event_target:     EventTarget;
    #command_observer: undefined|((cc: CommandContext<DocumentManager>) => void);
    #abort_signal:     undefined|AbortSignal;

    get dm               (){ return this.#dm; }
    get event_target     (){ return this.#event_target; }
    get command_observer (){ return this.#command_observer; }
    get abort_signal     (){ return this.#abort_signal; }

    #commands:                  SerialDataSource<CommandContext<DocumentManager>>;
    #key_map_stack:             Array<KeyMap>;
    #key_mapper:                null|KeyMapMapper;                         // set iff attached
    #key_handler:               undefined|((e: KeyboardEvent) => void);    // set iff attached
    #abort_signal_control:      undefined|AbortSignalActionControl<void>;  // set iff attached
    #listener_abort_controller: undefined|AbortController;                 // set iff attached

    get commands (){ return this.#commands; }

    get aborted  (){ return this.abort_signal?.aborted ?? false; }
    get detached (){ return !this.#key_mapper; }  // note: always true if this.aborted

    get_key_maps() {
        return Array.from(this.#key_map_stack);  // return a copy
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

    inject_key_event(key_event: KeyboardEvent): void {
        this.#key_handler?.(key_event);
    }

    /** Return a (somewhat clumsy) clone of a KeyboardEvent with a new target.
     * @param {KeyboardEvent} key_event to be cloned
     * @param {Node} replacement_target
     * @return {KeyboardEvent} cloned event
     * The goal is to clone the event but change target and currentTarget.
     * This is intended for use with inject_key_event().
     */
    static clone_key_event_with_alternate_target(key_event: KeyboardEvent, replacement_target: Node) {
        if (!(key_event instanceof KeyboardEvent)) {
            throw new Error('key_event must be an instance of KeyboardEvent');
        }
        if (!(replacement_target instanceof Node)) {
            throw new Error('replacement_target must be an instance of Node');
        }
        return {
            ...key_event,  // captures almost nothing, e.g., just the "isTrusted" property

            key:           key_event.key,       // non-enumerable getter
            metaKey:       key_event.metaKey,   // non-enumerable getter
            ctrlKey:       key_event.ctrlKey,   // non-enumerable getter
            shiftKey:      key_event.shiftKey,  // non-enumerable getter
            altKey:        key_event.altKey,    // non-enumerable getter

            preventDefault:  key_event.preventDefault.bind(key_event),
            stopPropagation: key_event.stopPropagation.bind(key_event),

            target:        replacement_target,
            currentTarget: replacement_target,
        };
    }


    // === INTERNAL ===

    #detach() {
        if (this.#abort_signal_control) {
            this.#abort_signal_control.abandon();
            this.#abort_signal_control = undefined;
        }
        if (this.#listener_abort_controller) {
            this.#listener_abort_controller.abort();  // remove event listeners
            this.#listener_abort_controller = undefined;
        }
        this.#key_mapper  = null;
        this.#key_handler = undefined;
    }

    #rebuild(): void {
        // rebuild the event handlers and state machine.

        // first, detach anything previous
        this.#detach();

        // now attach
        if (!this.aborted && this.#key_map_stack.length > 0) {  // otherwise nothing else to do
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

            // set ip the event listeners
            this.#key_handler = key_handler;  // for inject_key_event()

            this.#listener_abort_controller = new AbortController();
            const options = {
                capture: true,
                signal:  this.#listener_abort_controller.signal,
            };
            this.event_target.addEventListener('blur',    blur_handler as EventListener, options);
            this.event_target.addEventListener('keydown', key_handler  as EventListener, options);

            // set up the abort_signal control so that this.#detach is called if abort_signal fires
            this.#abort_signal_control = manage_abort_signal_action(this.#abort_signal, this.#detach.bind(this));
        }
    }
}
