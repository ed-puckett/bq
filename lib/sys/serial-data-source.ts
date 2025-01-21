import {
    Subject,
    Subscription,
} from 'rxjs';

export {
    Subscription,
} from 'rxjs';


export class SerialDataSource<T> {
    #subject = new Subject<T>();

    subscribe(observerOrNext: ((value: T) => void), signal: null|AbortSignal=null): Subscription {
        if (signal?.aborted) {
            throw new Error('signal already aborted');
        }
        const subscription = this.#subject.subscribe(observerOrNext);
        if (signal) {
            signal.addEventListener('abort', () => {
                subscription.unsubscribe();
            }, { once: true });
        }
        return subscription;
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
