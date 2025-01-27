import {
    Subject,
    Subscription,
} from 'rxjs';

export {
    Subscription,
} from 'rxjs';


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

        abort_signal?.throwIfAborted();

        const subscription = this.#subject.subscribe(observer);

        let listener_removal_controller: undefined|AbortController = undefined;
        if (abort_signal) {
            listener_removal_controller = new AbortController();
            abort_signal.addEventListener('abort', () => {
                listener_removal_controller = undefined;  // prevent future use
                subscription.unsubscribe();
            }, {
                signal: listener_removal_controller.signal,
                once:   true,
            });
        }

        const unsubscribe = () => {
            listener_removal_controller?.abort();
            subscription.unsubscribe();
        };

        return {
            unsubscribe,
            abort_signal,
        } as SerialDataSourceSubscription;
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
