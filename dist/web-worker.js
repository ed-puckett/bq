// this is Web Worker code

const AsyncFunction          = Object.getPrototypeOf(async function () {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {}).constructor;

self.onmessage = async function (message) {
    const { request, worker_id, id, expression, eval_context } = message.data;

    switch (request) {
    case 'eval': {
        try {
            const eval_function_this = eval_context;
            const eval_function = new AsyncFunction(expression).bind(eval_function_this);  // no arguments
            const value = await eval_function();
            self.postMessage({ id, value });
        } catch (error) {
            self.postMessage({ id, error });
        }
        break;
    }

    case 'stream_eval': {
        const eval_generator_this = eval_context;
        const eval_generator = new AsyncGeneratorFunction(expression).bind(eval_generator_this);  // no arguments
        try {
            for await (const value of eval_generator()) {
                self.postMessage({ id, value });
            }
        } catch (error) {
            self.postMessage({ id, error });
        }
        self.postMessage({ id, done: true });
        break;
    }

    default: {
        throw new Error(`unknown request ${request}`);
    }
    }
};
