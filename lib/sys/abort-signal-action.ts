// manage_abort_signal_action() establishes control over an action function
// where when an AbortSignal instances fires an 'abort' event, the given
// action function will be called.  Also, a new function wrapping the action
// function will be returned.  The result is that the given action function
// will be called when either the wrapped action function is called or the
// AbortSignal 'abort' event is fired.  In either case, the resources
// associated with this arrangement will be released.
//
// This is in contrast to simply adding an event listener to the abort_signal
// in which case the event listener will not be removed for a long-lived
// abort_signal.
//
// Note that the given action function should not be called, but instead the
// returned wrapped function should be called if direct control (i.e., not
// evented control) is desired.
//
// Note that the action function may get called multiple times....

export type AbortSignalActionControl<R> = {
    action:        (() => R),
    abort_signal?: AbortSignal,
};

export function manage_abort_signal_action<R>(
    abort_signal:          AbortSignal,
    action_implementation: (() => R),
): AbortSignalActionControl<R>
{
    if (typeof action_implementation !== 'function') {
        throw new TypeError('action_implementation must be a function');
    }
    if (!(abort_signal instanceof AbortSignal)) {
        throw new TypeError('abort_signal must be an instance of AbortSignal');
    }

    abort_signal.throwIfAborted();

    let listener_removal_controller: undefined|AbortController = new AbortController();

    abort_signal.addEventListener('abort', () => {
        listener_removal_controller = undefined;  // prevent future use
        action_implementation();
    }, {
        signal: listener_removal_controller.signal,
        once:   true,
    });

    const action = () => {
        listener_removal_controller?.abort();
        listener_removal_controller = undefined;  // prevent future use
        action_implementation();
    };

    return {
        action,
        abort_signal,
    } as AbortSignalActionControl<R>;
}
