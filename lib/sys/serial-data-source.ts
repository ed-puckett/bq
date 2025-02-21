import {
    Subject,
    Subscription,
} from 'rxjs';

import {
    AbortSignalAction,
} from 'lib/sys/abort-signal-action';


export type SerialDataSourceOptions = {
    abort_signal?: AbortSignal,
    once?:         Boolean,
};

export type SerialDataSourceSubscription = {
    abort_signal?: AbortSignal,
    unsubscribe:   (() => void),
};

export class SerialDataSource<T> {
    #subject = new Subject<T>();

    subscribe(observer: ((value: T) => void), options?: SerialDataSourceOptions): SerialDataSourceSubscription {
        const {
            abort_signal,
            once,
        } = (options ?? {} as SerialDataSourceOptions);

        abort_signal?.throwIfAborted();

        let subscription: undefined|SerialDataSourceSubscription;
        let unsubscribed = false;
        const subscription_observer = once
            ? (value: T) => {
                if (!unsubscribed) {
                    unsubscribed = true;
                    subscription?.unsubscribe();  // note: subscription is not undefined
                }
                observer(value);
            }
            : observer;
        subscription = this.#subject.subscribe(subscription_observer);

        const abort_signal_action = new AbortSignalAction(
            abort_signal,
            () => { subscription.unsubscribe(); },
        );
        const unsubscribe = () => {
            abort_signal_action.trigger();
        };

        return {
            abort_signal,
            unsubscribe,
        } as SerialDataSourceSubscription;
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
