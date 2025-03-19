/** AbortSignalAction instances manage the association of an one-shot action
 * function with an AbortSignal 'abort' event and ensure resource cleanup.
 */
export class AbortSignalAction {
    /** AbortSignalAction constructor
     *
     *  @param {undefined|AbortSignal} abort_signal
     *  @param {Function} action function to be associated with abort_signal
     *  @throws {Error|any} reason thrown by abort_signal.throwIfAborted()
     *                      if abort_signal is already aborted
     *
     * The given action function will be called at most once by this code, and
     * will be triggered by either calling this.trigger() or when abort_signal
     * fires an 'abort' event.
     *
     * As a convenience, abort_signal may be undefined in which case there is
     * no event-based trigger for the action function.  However, this.trigger()
     * can still be called, and will still only call the given action function
     * at most once.
     *
     * After the action function has been called, the resources associated with
     * the listener for the 'abort' event are released.  This is in contrast to
     * simply adding an event listener to the abort_signal in which case the
     * event listener will not be removed for a long-lived abort_signal.
     *
     * Calling this.unmanage() ends management and releases the associated
     * resources without triggering a call to the action function.  After
     * calling unmanage(), calling this.trigger() will throw an error.  Also,
     * if the abort_signal fires an 'abort' event after unmanage() has been
     * called, nothing happens.
     *
     * Warning: calling unmanage() prevents triggering the action function
     * later! (at least through this interface)
     */
    constructor(
        abort_signal: undefined|AbortSignal,
        action:       (() => void),
    ) {
        if (typeof action !== 'function') {
            throw new TypeError('action must be a function');
        }
        if (typeof abort_signal !== 'undefined' && !(abort_signal instanceof AbortSignal)) {
            throw new TypeError('abort_signal must be undefined or an instance of AbortSignal');
        }
        abort_signal?.throwIfAborted();

        this.#action       = action;
        this.#abort_signal = abort_signal;

        if (abort_signal) {
            this.#listener_removal_controller = new AbortController();

            abort_signal.addEventListener('abort', () => {
                this.#listener_removal_controller = undefined;  // prevent future use (note: once is true, below)
                this.trigger();
            }, {
                signal: this.#listener_removal_controller.signal,
                once:   true,  // important because this.#listener_removal_controller was disabled above
            });
        }
    }

    /** @return {undefined|AbortSignal} abort_signal given in the constructor
     */
    get abort_signal (){ return this.#abort_signal }

    /** "manually" trigger the action function.
     * Note that the action function will be called at most once by this code,
     * whether as a result of the given abort_signal firing an 'abort' event
     * or by this function being called.
     * @throws {Error} after this.unmanage() has been called.
     */
    trigger() {
        this.throw_if_unmanaged();
        this.#remove_listener();
        if (!this.#action_called) {
            this.#action_called = true;  // set first just in case
            this.#action();
        }
    }

    /** end management and release associated resources.
     */
    unmanage() {
        this.#remove_listener();
        this.#unmanaged = true;
    }

    /** @return {Boolean} true iff this.unmanage() has been called.
     */
    get unmanaged (){ return this.#unmanaged; }

    throw_if_unmanaged() {
        if (this.#unmanaged) {
            throw new Error('no longer managed');
        }
    }


    // --- internal ---

    // initialized in constructor:
    #abort_signal: undefined|AbortSignal;
    #action:       (() => void);

    // state:
    #listener_removal_controller: undefined|AbortController = undefined;
    #action_called = false;
    #unmanaged     = false;

    #remove_listener() {
        if (this.#listener_removal_controller) {
            this.#listener_removal_controller.abort();
            this.#listener_removal_controller = undefined;  // prevent future use
        }
    }
}
