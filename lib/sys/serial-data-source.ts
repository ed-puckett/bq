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
    abort_signal?: AbortSignal,
    unsubscribe:   (() => void),
};

export class SerialDataSource<T> {
    #subject = new Subject<T>();

    subscribe(observer: ((value: T) => void), options?: SerialDataSourceOptions): SerialDataSourceSubscription {
        const {
            abort_signal,
        } = (options ?? {} as SerialDataSourceOptions);

        abort_signal?.throwIfAborted();

        const subscription = this.#subject.subscribe(observer);

        const {
            action: unsubscribe,
        } = manage_abort_signal_action(
            abort_signal,
            () => { subscription.unsubscribe(); },
        );

        return {
            abort_signal,
            unsubscribe,
        } as SerialDataSourceSubscription;
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
