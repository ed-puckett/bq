import {
    Subject,
    Observer,
    Subscription,
} from 'rxjs';

export {
    Subscription,
} from 'rxjs';


export class SerialDataSource<T> {
    #subject = new Subject<T>();

    subscribe(observerOrNext: ((value: T) => void)): Subscription {
        return this.#subject.subscribe(observerOrNext);
    }

    dispatch(data: T) {
        this.#subject.next(data);
    }
}
