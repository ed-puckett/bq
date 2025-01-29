import {
    Subject,
    Subscription,
} from 'rxjs';

import {
    manage_abort_signal_action,
} from 'lib/sys/abort-signal-action';


export type SerialDataSourceOptions = {
    abort_signal?: AbortSignal,
};

export type SerialDataSourceSubscription = {
    unsubscribe:   (() => void),
    abort_signal?: AbortSignal,
};

export class SerialDataSource<T> {
    #subject = new Subject<T>();

    subscribe(observer: ((value: T) => void), options?: SerialDataSourceOptions): SerialDataSourceSubscription {
        const {
            abort_signal,
        } = (options ?? {} as SerialDataSourceOptions);

        const subscription = this.#subject.subscribe(observer);
        const unsubscribe_implemention = () => { subscription.unsubscribe(); };

        const unsubscribe = abort_signal
            ? manage_abort_signal_action(abort_signal, unsubscribe_implemention).action
            : unsubscribe_implemention;

        return {
            unsubscribe,
            abort_signal,
        } as SerialDataSourceSubscription;
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
