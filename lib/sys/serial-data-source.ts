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

        if (abort_signal?.aborted) {
            throw new Error('abort_signal already aborted');
        }
        const subscription = this.#subject.subscribe(observer);
        if (abort_signal) {
            abort_signal.addEventListener('abort', () => {
                subscription.unsubscribe();
            }, { once: true });
        }
        return {
            unsubscribe: subscription.unsubscribe.bind(subscription),
            abort_signal,
        } as SerialDataSourceSubscription;
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
