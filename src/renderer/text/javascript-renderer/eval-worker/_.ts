const current_script_url = import.meta.url;  // save for later

import {
    Activity,
} from 'lib/sys/activity-manager';

import {
    generate_object_id,
} from 'lib/sys/uuid';

import {
    OpenPromise,
} from 'lib/sys/open-promise';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


type WorkerResult = {
    value?: any,
    done?:  boolean,
    error?: Error,
};

export class EvalWorker extends Activity {
    get CLASS () { return this.constructor as typeof EvalWorker; }

    readonly #keepalive: boolean;
    readonly #id:        string;
    #worker:             undefined|Worker;
    #current_expression: any;

    /** @param {null|undefined|Object} options: {
     *      keepalive?: boolean,  // (default false) keep running after eval() or stream_eval() completes
     *  }
     */
    constructor(options?: object) {
        super();  // Activity base class; multiple_stops = false

        const {
            keepalive = false,
        } = (options ?? {}) as any;

        this.#keepalive          = !!keepalive;
        this.#id                 = generate_object_id();
        this.#worker             = new Worker(this.CLASS.#worker_code_uri);
        this.#current_expression = undefined;
    }

    get keepalive (){ return this.#keepalive; }
    get id        (){ return this.#id; }

    stop(): void {
        this.#reset_event_handlers();
        this.#current_expression?.stop();
        this.#current_expression = undefined;
        this.#worker?.terminate();
        this.#worker = undefined;

        super.stop();
    }

    async eval(expression: string, eval_context: object): Promise<any> {
        if (this.stopped) {
            throw new Error(`eval worker ${this.id}: worker has been stopped`);
        }
        if (!this.#worker) {
            throw new Error('worker does not exist');
        }
        if (this.#current_expression) {
            throw new Error(`eval worker ${this.id}: an expression evaluation is already in process`);
        }

        const result_promise = new OpenPromise<any>();
        let result_promise_fulfilled = false;

        const handle_done = () => {
            this.#current_expression = undefined;
            this.#reset_event_handlers();
            if (!result_promise_fulfilled) {
                result_promise.reject(new Error(`eval worker ${this.id} / expression ${expression_id}: evaluation stopped`));
            }
            if (!this.keepalive) {
                this.stop();
            }
        };

        const expression_id = generate_object_id();

        const worker_message = {
            request: 'eval',
            id: expression_id,
            worker_id: this.id,
            expression,
            eval_context,
        };

        this.#current_expression = {
            ...worker_message,
            stop(): void {
                handle_done();
            },
        };

        this.#worker.onmessage = (event: { data: WorkerResult }) => {
            const result = event.data;
            if ('value' in result) {
                result_promise.resolve(result.value);
            } else {
                result_promise.reject((result as any).error);
            }
            result_promise_fulfilled = true;
            handle_done();
        };
        this.#worker.onerror = (event) => {
            result_promise.reject(new Error(`eval worker ${this.id} / expression ${expression_id}: error in worker`));
            result_promise_fulfilled = true;
            handle_done();
        };
        this.#worker.onmessageerror = (event) => {
            result_promise.reject(new Error(`eval worker ${this.id} / expression ${expression_id}: serialization error in worker`));
            result_promise_fulfilled = true;
            handle_done();
        };

        this.#worker.postMessage(worker_message);

        return result_promise.promise;
    }

    // returns an async interator, i.e., this function is an async generator
    stream_eval(expression: string, eval_context: object) {
        const self = this;

        if (self.stopped) {
            throw new Error(`eval worker ${self.id}: worker has been stopped`);
        }
        if (!self.#worker) {
            throw new Error('worker does not exist');
        }
        if (self.#current_expression) {
            throw new Error(`eval worker ${self.id}: an expression evaluation is already in process`);
        }

        // at least one of pending_results and pending_promises should be empty at any given time
        const pending_results:  Array<WorkerResult>              = [];  // values/errors waiting to be consumed
        const pending_promises: Array<OpenPromise<WorkerResult>> = [];  // consumed promises waiting for a value/error
        let done = false;

        const handle_done = () => {
            done = true;
            self.#current_expression = undefined;
            self.#reset_event_handlers();
            while (pending_promises.length > 0) {
                pending_promises.shift()?.resolve({ done: true });
            }
            if (!self.keepalive) {
                self.stop();
            }
        };

        const handle_result = (result: WorkerResult) => {
            if (done) {
                console.warn(`eval worker ${self.id} / expression ${expression_id}: result received after done`, result);
            } else {
                if (pending_promises.length > 0) {
                    if ('value' in result) {
                        pending_promises.shift()?.resolve({ value: result.value });
                    } else {
                        pending_promises.shift()?.reject(result.error);
                    }
                } else {
                    pending_results.push(result);
                }

                // errors stop the stream
                if (result.error) {
                    handle_done();
                }
            }
        };

        const expression_id = generate_object_id();

        const worker_message = {
            request: 'stream_eval',
            id: expression_id,
            worker_id: self.id,
            expression,
            eval_context,
        };

        self.#current_expression = {
            ...worker_message,
            stop(): void {
                handle_done();
            },
        };

        self.#worker.onmessage = (event) => {
            const result = event.data;
            if (result.done) {
                handle_done();
            } else {
                handle_result(result);
            }
        };
        self.#worker.onerror = (event) => {
            handle_result({ error: new Error(`eval worker ${self.id} / expression ${expression_id}: error in worker`) });
            handle_done();
        };
        self.#worker.onmessageerror = (event) => {
            handle_result({ error: new Error(`eval worker ${self.id} / expression ${expression_id}: serialization error in worker`) });
            handle_done();
        };

        self.#worker.postMessage(worker_message);

        return {
            [Symbol.asyncIterator]() {
                let i = 0;
                return {
                    next() {
                        if (pending_results.length > 0) {
                            const result = pending_results.shift();
                            if (result && 'value' in result) {
                                return Promise.resolve({ value: result?.value });
                            } else {
                                return Promise.reject((result as any)?.error);
                            }
                        } else if (done) {
                            while (pending_promises.length > 0) {
                                pending_promises.shift()?.reject(new Error(`eval worker ${self.id} / expression ${expression_id}: no further results available`));
                            }
                            return Promise.resolve({ done: true });
                        } else {
                            const new_promise = new OpenPromise<WorkerResult>();
                            pending_promises.push(new_promise);
                            return new_promise.promise;
                        }
                    },
                    return() {
                        // This will be reached if the consumer called 'break' or 'return' early in the loop.
                        return { done: true };
                    },
                };
            },
        };
    }

    #reset_event_handlers() {
        if (this.#worker) {
            this.#worker.onmessage      = null;
            this.#worker.onerror        = null;
            this.#worker.onmessageerror = null;
        }
    }

    // Safari does not support static initialization blocks in classes (at the time of writing), so do it this way:
    static #worker_code_uri: string;

    static async _async_init_static() {
        // create a data: URI for the web worker code so that we avoid cross-origin access errors
        // see: https://stackoverflow.com/questions/23953543/cross-domain-web-workers
        // and: https://github.com/CezaryDanielNowak/CrossOriginWorker/blob/main/index.js
        const worker_url = new URL('../../../../../dist/web-worker.js', assets_server_url(current_script_url));  // ./web-worker.js is copied to dist/ dir by build process
        return fetch(worker_url)
            .then(res => res.text())
            .catch(error => {
                throw new Error('unable to fetch worker code');
            })
            .then(code => {
                const preamble = `\
{
    const original_importScripts = globalThis.importScripts;
    globalThis.importScripts = (...urls) => {
        return original_importScripts( ...urls.map(url => new URL(url, "${worker_url.href}")) );
    };
}
`;
                this.#worker_code_uri = `data:text/javascript,${encodeURIComponent(preamble + code)}`;
            });
    }
}

// Safari does not support static initialization blocks in classes (at the time of writing), so do it this way:
await EvalWorker._async_init_static();
