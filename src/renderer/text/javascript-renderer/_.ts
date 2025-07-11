const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

const lib_dir_path = '../../../lib/';
const src_dir_path = '../../../src/';
const lib_dir_url  = new URL(lib_dir_path, assets_server_url(current_script_url));
const src_dir_url  = new URL(src_dir_path, assets_server_url(current_script_url));

// provide an implementation of dynamic import that is safe from modification by webpack
const dynamic_import = new Function('path', 'return import(path);');


// ======================================================================
// !!! update !!!
// JAVASCRIPT CODE RENDERING
// -------------------------
// JavaScript code is rendered by evaluating it.  Specifically, the code
// becomes the body of a new async generator function.  This function is
// then called and its output(s) are rendered.
//
// Within the code given for evaluation, "this" is initially set to a
// reference to bqv, an environment (namespace) derived from the
// global_state property of the options passed to the _render() method.
//
// vars(...objects) assigns new properties to "bqv".  The return value is
// the array of the given arguments (unmodified).
//
// A return statement within a cell terminates the evaluation (except
// for asynchronous parts that have already been started), and the
// value passed to the return statement becomes the synchronous result
// of the evaluation.  Intermediate values may be returned via yield
// statements.
//
// evaluation namespace
// --------------------
// During evaluation, several variable are available implicitly (without the
// need to reference them through another object).  The evaluation environment
// comprises these variables, and this is also available (self-referentially)
// as the "eval_environment" variable.  The eval_environment is specific to
// one particular evaluation.  However, one of the variables, "bqv", references
// the notebook-wide evaluation environment which persists across evalutions
// and across all cells in a notebook.
//
//     bqv:           the notebook-wide evaluation environment
//     println:       prints its argument followed by newline
//     printf:        implementation of std C printf()
//     sprintf:       implementation of std C sprintf()
//     import_local:  import other libraries from local directories
//     vars:          export new "global" properties
//     is_stopped:    determine if the rendering/evaluation has been stopped
//     delay_ms:      return a Promise that resolves after a specified delay
//     create_worker: create a new EvalWorker instance
//!!!
//     eval_environment
//     vars
//     bqv
//     ocx
//     source_code
//     cell
//     is_stopped
//     keepalive
//     bg
//     end_bg
//     make_check_tick
//     create_worker
//     import_local
//     sleep
//     delay_ms
//     next_tick
//     next_micro_tick
//     sprintf
//     JSON5
//     render_value
//     render_error
//     print
//     println
//     tty
//     ttyln
//     printf
//     print__
//     javascript
//     markdown
//     latex
//     image_data
//     graphviz
//     plotly
//     canvas_tools
//     d3
//     load_Plotly
//     load_Algebrite
//     range
//     uuidv4
//     rxjs
//     get_settings
//     get_themes_settings
//     babel_parse
//     JavaScriptParseError
//     LocatedError
//     BqManager
//     BqCellElement
//     OutputContext
//     Renderer
//     TextBasedRenderer
//     ApplicationBasedRenderer
//     Activity
//     ActivityManager
//     Dialog
//     Menu
//     KeyEventManager
//     KeyMap
//     KeyMapMapper
//     KeySpec
//     OpenPromise
//     AbortSignalAction
//     SerialDataSource
//!!!
//
// These all continue to be available to active async operations, even
// after the main evaluation returns.
//
// See the method #create_eval_environment() for details of the creation
// of eval_environment.
// ======================================================================

const AsyncFunction          = Object.getPrototypeOf(async function () {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {}).constructor;

import {
    BqManager,
} from 'src/bq-manager/_';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    Renderer,
    TextBasedRenderer,
    ApplicationBasedRenderer,
    LocatedError,
    _initial_text_renderer_factories,
} from 'src/renderer/renderer';

import {
    TextBasedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    ErrorRendererValueType,
    ErrorRendererOptionsType,
} from 'src/renderer/application/types';

import {
    ErrorRenderer,
} from 'src/renderer/application/error-renderer';

import {
    OutputContext,
} from 'src/output-context';

import {
    Activity,
    ActivityManager,
} from 'lib/sys/activity-manager'

import {
    EvalWorker,
} from './eval-worker/_';

import {
    Dialog,
} from 'lib/ui/dialog/_';

import {
    Menu,
} from 'lib/ui/menu/_';

import {
    KeyEventManager,
    KeyMap,
    KeyMapMapper,
    KeySpec,
} from 'lib/ui/key/_';

import {
    OpenPromise,
} from 'lib/sys/open-promise';

import {
    AbortSignalAction,
} from 'lib/sys/abort-signal-action';

import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    JSON5,
} from 'lib/sys/json5';

import {
    uuidv4,
} from 'lib/sys/uuid';

import {
    load_d3,
} from 'src/renderer/application/d3';

import {
    load_Plotly,
} from 'src/renderer/application/plotly';

import {
    load_Algebrite,
} from 'lib/sys/algebrite';

import {
    get_settings,
    get_themes_settings,
} from 'src/settings/_';

import * as rxjs from 'rxjs';

import * as canvas_tools from 'lib/ui/canvas-tools';

import {
    parse as babel_parse,
} from 'lib/sys/babel-parser';


export class JavaScriptParseError extends LocatedError {
    constructor(babel_parse_error_object: any, underlying_error: unknown, ocx: OutputContext) {
        super( babel_parse_error_object.toString(),
               babel_parse_error_object.loc.line,
               babel_parse_error_object.loc.column,
               ocx,
               {
                   cause: underlying_error,
               } );
        this.#babel_parse_error_object = babel_parse_error_object;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    #babel_parse_error_object: any;

    get babel_parse_error_object (){ return this.#babel_parse_error_object; }
}


export class JavaScriptRenderer extends TextBasedRenderer {
    static get type (){ return 'javascript'; }

    // the following is necessary for the initial TextBasedRenderer extensions:
    static { _initial_text_renderer_factories.push(this); }

    /** Render by evaluating the given code and outputting to ocx.
     * @param {OutputContext} ocx,
     * @param {String} code,
     * @param {undefined|TextBasedRendererOptionsType} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContext, code: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        const global_state = options?.global_state ?? ocx.bq.global_state;

        const bqv = ((global_state as any)[this.type] ??= {});

        const eval_ocx = ocx.CLASS.ocx_for_options(ocx, options);

        const eval_environment = await this.#create_eval_environment(bqv, eval_ocx, code);
        const eval_environment_entries = Object.entries(eval_environment);

        // create an async generator with the given code as the heart of its
        // body, and with parameters being the keys of eval_environment.
        // Then, the code will be evaluated by applying the function to the
        // corresponding values from eval_environment.  Note that evaluation
        // will be performed in the JavaScript global environment and that
        // the implicit evaluation environment implicit variables are
        // implemented via the function parameters/arguments.
        const eval_fn_params = eval_environment_entries.map(([k, _]) => k);
        const eval_fn_args   = eval_environment_entries.map(([_, v]) => v);

        // evaluate the code:
        const eval_fn_this = bqv;
        // add newline to code to prevent problems in case the last line is a // comment
        const code_to_run = `"use strict";${code}\n`;
        const eval_fn_body = code_to_run;
        let eval_fn;
        try {
            eval_fn = new AsyncGeneratorFunction(...eval_fn_params, eval_fn_body);
        } catch (parse_error: unknown) {
            let updated_parse_error = parse_error;
            try {
                const parse_result = babel_parse(code_to_run, {
                    errorRecovery: true,
                });
                if (parse_result.errors.length <= 0) {
                    console.warn('unexpected: got error while creating AsyncGeneratorFunction but babel_parse did not return errors; throwing received error', parse_error);
                    // just leave updated_parse_error as is
                } else {
                    updated_parse_error = new JavaScriptParseError(parse_result.errors[0], parse_error, eval_ocx);
                }
            } catch (babel_error: unknown) {
                updated_parse_error = new JavaScriptParseError(babel_error, parse_error, eval_ocx);
            }
            throw updated_parse_error;
        }
        const result_stream = eval_fn.apply(eval_fn_this, eval_fn_args);

        // note that using for await ... of misses the return value and we
        // want to process that, too.  Therefore, instead of the following:
        //
        // for await (const result of result_stream) {
        //     if (typeof result !== 'undefined') {
        //         await eval_environment.render_value(result);
        //     }
        // }
        //
        // we consume the stream "manually":

        eval_loop:
        while (!eval_ocx.stopped) {
            let caught_error: unknown = undefined;
            const result = await result_stream.next()
                .catch((error: unknown) => { caught_error = error; });
            if (caught_error) {
                // it might be tempting to handle the error here (for example,
                // by rendering the error to the eval_ocx) but it is important
                // that the error be propagated out to the multi-cell eval
                // case in BqManager, otherwise the evaluation just continues
                // after an error occurs.  One idea is to create a special
                // "error element" that can be recognized further up as an
                // error, but this seems kludgey.  So (for now at least) the
                // user is required to handle potential errors in their code.
                // See: src/examples/unhandled-rejection.html
                throw caught_error;
            }

            const { value, done } = result;

            // output any non-undefined values that were received either from
            // a return or a yield statement in the code
            if (typeof value !== 'undefined') {
                await eval_environment.render_value(value, { inline: true });
            }

            if (done) {
                break eval_loop;
            }
        }

        return eval_ocx.element;
    }

    async #create_eval_environment(bqv: object, ocx: OutputContext, source_code: string) {
        const cell_id = ocx.element.closest(`[${OutputContext.attribute__data_source_element}]`)?.getAttribute(OutputContext.attribute__data_source_element);
        const cell = cell_id ? (document.getElementById(cell_id) ?? undefined) : undefined;

        const d3 = await load_d3();

        function is_stopped() {
            return ocx.stopped;
        }

        function keepalive(keepalive: boolean = true) {
            ocx.keepalive = keepalive;
        }

        async function bg(thunk: () => any, set_keepalive: boolean = true) {
            const error_handler = (error: unknown) => { ocx.render_error(error); }
            try {
                if (set_keepalive) {
                    keepalive();
                }
                let promise: undefined|Promise<any> = undefined;
                if (thunk instanceof AsyncFunction) {
                    promise = thunk();
                } else if (thunk instanceof Function) {
                    promise = (async () => thunk())();
                } else {
                    throw new TypeError('thunk must be a function or an async function');
                }
                // it is important to catch errors here to prevent unhandled rejections
                return promise?.catch(error_handler);
            } catch (error: unknown) {
                error_handler(error);
            }
        }

        function end_bg(aggressive: boolean = false) {
            let ancestor_ocx = ocx;
            for (let parent; (parent = ancestor_ocx.parent); ancestor_ocx = parent) {
                if ( !aggressive &&
                     parent.children.some(activity => !activity.stopped && activity !== ancestor_ocx) ) {
                    // parent has unstopped children that are not ancestor_ocx
                    break;
                }
            }
            ancestor_ocx.stop();
        }

        // Mechanism to yield for long computations:
        // make_check_tick() returns an aync function such that when that function
        // is called (and awaited), will await a call to next_tick() if the the
        // specified time has elapsed since the last time this function called
        // next_tick() and return true.  Otherwise, if the specified time has
        // not elapsed, the function returns false immediately.
        const make_check_tick = (the_tick_interval_ms=200) => {
            let last_tick_time = Date.now();
            const check_tick = (tick_interval_ms=the_tick_interval_ms) => {
                // Return a promise only if next_tick() is to be called.
                // Otherwise, return a simple false value.
                const new_last_tick_time = Date.now();
                if (new_last_tick_time-last_tick_time < tick_interval_ms) {
                    return false;
                } else {
                    last_tick_time = new_last_tick_time;
                    return new Promise(resolve => {
                        ocx.next_tick()
                            .then(() => resolve(true));
                    });
                }
            };
            return ocx.AIS(check_tick);
        };

        function* range(...args: any[]) {
            ocx.abort_if_stopped();
            let start = 0, limit, step = 1;
            switch (args.length) {
                case 1: ([ limit ] = args);              break;
                case 2: ([ start, limit ] = args);       break;
                case 3: ([ start, limit, step ] = args); break;
                default: throw new TypeError('usage: range([ start ], limit, [ step ])');
            }
            for (const [ name, variable ] of [
                [ 'start', start ],
                [ 'limit', limit ],
                [ 'step',  step  ],
            ]) {
                if (typeof variable !== 'number') {
                    throw new TypeError(`${name} must be a number`);
                }
            }
            for (let i = start; i < limit; i += step) {
                ocx.abort_if_stopped();
                yield i;
            }
        }

        async function create_worker(options?: object) {
            const worker = new EvalWorker(options);  // is an Activity; multiple_stops = false
            ocx.manage_activity(worker);
            return worker;
        }

        async function import_local(location_relative_path: string) {
            return dynamic_import(new URL(location_relative_path, document.location.href));
        }

        function vars(...objects: object[]) {
            Object.assign((bqv as any), ...objects);
            return objects;
        }

        const eval_environment = {
            eval_environment: undefined as any,  // updated below to be a direct self reference

            vars:             ocx.AIS(vars),
            bqv,              // the notebook-wide evaluation environment (the "this" parameter is a synonym on entry)
            ocx,              // this evaluation's OutputContext instance
            source_code,      // this evaluation's source code
            cell,             // this evaluation's associated cell or undefined if no associated cell

            is_stopped,       // no abort_if_stopped()....
            keepalive:        ocx.AIS(keepalive),
            bg,               // don't wrap with AIS because that will cause an unhandled rejection if stopped
            end_bg,           // don't wrap with AIS because that will cause an error

            make_check_tick:  ocx.AIS(make_check_tick),

            create_worker:    ocx.AIS(create_worker),
            import_local:     ocx.AIS(import_local),

            // sleep, etc
            sleep:            ocx.sleep.bind(ocx),
            delay_ms:         ocx.delay_ms.bind(ocx),
            next_tick:        ocx.next_tick.bind(ocx),
            next_micro_tick:  ocx.next_micro_tick.bind(ocx),

            sprintf:          ocx.sprintf.bind(ocx),

            JSON5,

            // output functions defined by ocx
            render_value:     ocx.render_value.bind(ocx),
            render_error:     ocx.render_error.bind(ocx),
            print:            ocx.print.bind(ocx),
            println:          ocx.println.bind(ocx),
            tty:              ocx.tty.bind(ocx),
            ttyln:            ocx.ttyln.bind(ocx),
            printf:           ocx.printf.bind(ocx),
            print__:          ocx.print__.bind(ocx),

            // code and graphics rendering defined by ocx
            javascript:       ocx.javascript.bind(ocx),
            markdown:         ocx.markdown.bind(ocx),
            latex:            ocx.latex.bind(ocx),
            image_data:       ocx.image_data.bind(ocx),
            graphviz:         ocx.graphviz.bind(ocx),
            plotly:           ocx.plotly.bind(ocx),
            canvas_tools,

            d3,  // for use with Plotly
            load_Plotly,
            load_Algebrite,

            range,
            uuidv4:           ocx.AIS(uuidv4),
            rxjs,

            get_settings,
            get_themes_settings,

            // parse support
            babel_parse,
            JavaScriptParseError,
            LocatedError,

            // ui, Renderer, etc classes
            BqManager,
            BqCellElement,
            OutputContext,
            Renderer,
            TextBasedRenderer,
            ApplicationBasedRenderer,
            Activity,
            ActivityManager,
            Dialog,
            Menu,
            KeyEventManager,
            KeyMap,
            KeyMapMapper,
            KeySpec,
            OpenPromise,
            AbortSignalAction,
            SerialDataSource,
        };

        eval_environment.eval_environment = eval_environment;

        return eval_environment;
    }
}
