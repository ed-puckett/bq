import {
    OutputContext,
} from 'src/output-context';


export class LocatedError extends Error {
    constructor( message:      string,
                 line_number:  number,
                 column_index: number,
                 ocx:          OutputContext,
                 options?:     { cause?: unknown } ) {
        super(message, options);
        this.#ocx = ocx;
        this.#line_number  = line_number;
        this.#column_index = column_index;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    #line_number:  number;
    #column_index: number;
    #ocx:          OutputContext;

    get line_number  (){ return this.#line_number; }
    get column_index (){ return this.#column_index; }

    get ocx (){ return this.#ocx; }
}
