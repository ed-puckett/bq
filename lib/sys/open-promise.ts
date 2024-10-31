/** a Promise-like object with its resolve and reject methods exposed externally
 */
export class OpenPromise<T> {
    readonly promise: Promise<T>;
    readonly resolve: (value: T | PromiseLike<T>) => void;
    readonly reject:  (reason?: any) => void;
    readonly then:    Promise<T> extends { then:    infer MT } ? MT : never;
    readonly catch:   Promise<T> extends { catch:   infer MT } ? MT : never;
    readonly finally: Promise<T> extends { finally: infer MT } ? MT : never;

    constructor() {
        // Typescript does not understand that resolve and reject are set in the call to new Promise(),
        // so go ahead and initialize resolve and reject here...
        let resolve: (value: T | PromiseLike<T>) => void = (x?: T | PromiseLike<T>) => {};
        let reject:  (reason?: any)              => void = (reason?: any) => {};
        const promise = new Promise<T>((o, x) => { resolve = o; reject = x; });

        this.promise = promise;
        this.resolve = resolve;
        this.reject  = reject;
        this.then    = promise.then.bind(promise);
        this.catch   = promise.catch.bind(promise);
        this.finally = promise.finally.bind(promise);
    }

    async await() { return await this.promise; }
}
