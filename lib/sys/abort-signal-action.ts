
export type AbortSignalActionControl<R> = {
    abort_signal?: AbortSignal,
    action:        (() => R),
    abandon:       (() => void),
};

/** manage_abort_signal_action<R>() establishes control over an action function
 * to be associated with an AbortSignal.
 *
 * @param {undefined|null|AbortSignal} abort_signal
 * @param {Function} action function implementation
 * @throws {Error|any} reason thrown by abort_signal.throwIfAborted()
 *                     if abort_signal is already aborted
 * @return {AbortSignalActionControl<R>} control: {
 *     abort_signal?: undefined|AbortSignal,  // (null becomes undefined)
 *     action:        (() => R)               // wrapped action function,
 *     abandon:       (() => void),           // call to abandon management
 * }
 *
 * The given action function implementation is associated with an AbortSignal
 * 'abort' event.
 *
 * The action function implementation will be called at most once by this code,
 * and will be triggered by either calling the returned wrapped function or
 * if the abort_signal fires an 'abort' event.
 *
 * As a convenience, abort_signal may be undefined or null in which case there
 * is no evented trigger for calling the action function.  However, the returned
 * wrapped function can still be called, and will still call the implementation
 * at most once.
 *
 * Once the action function implementation has been called, the resources
 * associated with the listener for the 'abort' event are released.  This is in
 * contrast to simply adding an event listener to the abort_signal in which case
 * the event listener will not be removed for a long-lived abort_signal.
 *
 * The returned abandon function stops management and releases the associated
 * resources without triggering a call to the action function implementation.
 * After calling abandon, calling any of the returned functions (the wrapped
 * action function or the abandon function) will throw an error.  Also, if the
 * abort_signal fires an 'abort' event after abandon has been called, nothing
 * happens.
 *
 * Warning: calling abandon prevents triggering the action function later!
 */
export function manage_abort_signal_action<R>(
    abort_signal:          undefined|null|AbortSignal,
    action_implementation: (() => R),
): AbortSignalActionControl<R>
{
    if (typeof action_implementation !== 'function') {
        throw new TypeError('action_implementation must be a function');
    }
    if (typeof abort_signal !== 'undefined' && abort_signal !== null && !(abort_signal instanceof AbortSignal)) {
        throw new TypeError('abort_signal must be undefined, null, or an instance of AbortSignal');
    }

    abort_signal?.throwIfAborted();

    let listener_removal_controller: undefined|AbortController = undefined;
    const remove_listener = () => {
        if (listener_removal_controller) {
            listener_removal_controller.abort();
            listener_removal_controller = undefined;  // prevent future use
        }
    };

    let abandoned = false;
    const throw_if_abandoned = () => {
        if (abandoned) {
            throw new Error('abandoned');
        }
    };

    let action_implementation_called = false;
    const action = () => {
        throw_if_abandoned();
        remove_listener();
        if (!action_implementation_called) {
            action_implementation_called = true;
            action_implementation();
        }
    };

    if (abort_signal) {
        listener_removal_controller = new AbortController();

        abort_signal.addEventListener('abort', () => {
            listener_removal_controller = undefined;  // prevent future use (note: once is true, below)
            action();
        }, {
            signal: listener_removal_controller.signal,
            once:   true,  // important because listener_removal_controller was disabled above
        });
    }

    const abandon = () => {
        remove_listener();
        abandoned = true;
   };

    return {
        abort_signal: (abort_signal ?? undefined),  // (null becomes undefined)
        action,
        abandon,
    } as AbortSignalActionControl<R>;
}
