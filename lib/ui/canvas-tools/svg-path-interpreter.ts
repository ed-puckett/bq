// === SVG PATH INTERPRETER ===

/** Run an implementation of the SVG path element.
 *  @param {CanvasRenderingContext2D} ctx
 *  @param {String} commands, the contents of the SVG path d attribute
 *  Note: only a subset of the possible commands is implemented, those
 *        that are needed for hand_drawing_commands.
 *  See: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/d
 */
export const svg_path_interpreter = (ctx: CanvasRenderingContext2D, commands: string) => {
    let command_idx = 0;
    const skip_separators = () => {
        for ( ; command_idx < commands.length && commands[command_idx].match(/^[\s,]$/); command_idx++) {
            // keep scanning...
        }
    };
    const parse_number = (): number => {
        skip_separators();
        const initial = command_idx;
        if (commands[initial] === '-') {
            command_idx++;
        }
        let saw_dot = false;
        for ( let match; command_idx < commands.length && (match = commands[command_idx].match(/^([.0-9])$/)); command_idx++) {
            if (match?.[0] === '.') {
                if (saw_dot) {
                    throw new Error(`[idx=${command_idx}]: number specified with more than one "."`);
                }
                saw_dot = true;
            }
            // keep scanning...
        }
        if (command_idx === initial) {
            throw new Error(`[idx=${command_idx}]: no number found`);
        }
        const value = parseFloat(commands.slice(initial, command_idx));
        if (Number.isNaN(value)) {
            throw new Error(`[idx=${command_idx}]: unable to parse number`);
        }
        return value;
    };

    const is_number_available = (): boolean => {
        skip_separators();
        return command_idx < commands.length && !!commands[command_idx].match(/^[-.0-9]$/);
    };

    const get_points_and_run_command = (
        is_command_relative:    boolean,
        point_count:            number,
        command_implementation: ((points: Array<[number, number]>) => void),
    ) => {
        // collect points
        const points: Array<[number, number]> = [];
        for (let i = 0; i < point_count; i++) {
            const a = parse_number();
            const b = parse_number();
            points.push([ a,  b ]);
        }
        // adjust points if relative
        if (is_command_relative) {
            for (const point of points) {
                point[0] += x;
                point[1] += y;
            }
        }
        // set new (x, y)
        x = points[points.length - 1][0];
        y = points[points.length - 1][1];
        // run the command
        command_implementation(points);
    };

    const get_arguments_and_draw_h_or_v_line = (
        is_command_relative: boolean,
        v_line:              boolean,
    ) => {
        // capture (x, y) as start point
        const x1 = x;
        const y1 = y;
        // get argument
        let x2, y2;
        if (v_line) {
            x2 = 0;
            y2 = parse_number();
        } else {
            x2 = parse_number();
            y2 = 0;
        }
        // adjust points if relative
        if (is_command_relative) {
            x2 += x1;
            y2 += y1;
        }
        // draw the line
        ctx.lineTo(x2, y2);
        // set the new current point
        x = x2;
        y = y2;
    };

    const vector_angle = (ux: number, uy: number, vx: number, vy: number): number => {
        // Note: cos_theta is clamped to be in [-1, 1]; necessary because of rounding errors, for example saw something like cos_theta = -1.00000002
        const cos_theta = Math.min(1, Math.max(-1, (ux*vx + uy*vy) / Math.sqrt(ux*ux + uy*uy) / Math.sqrt(vx*vx + vy*vy)));
        const theta_sign_determiner = ux*vy - uy*vx;
        const theta = ((theta_sign_determiner < 0) ? -1 : 1) * Math.acos(cos_theta);
        return theta;
    }

    const get_arguments_and_run_elliptical_arc_curve_command = (is_command_relative: boolean): void => {
        // capture (x, y) as start point
        const x1 = x;
        const y1 = y;
        // get arguments
        let   rx             = parse_number();
        let   ry             = parse_number();
        const angle          = parse_number();  // degrees
        const large_arc_flag = parse_number();
        const sweep_flag     = parse_number();
        const x2             = is_command_relative ? x1+parse_number() : parse_number();
        const y2             = is_command_relative ? y1+parse_number() : parse_number();
        if (large_arc_flag !== 0 && large_arc_flag !== 1) {
            throw new Error('large_arc_flag must be 0 or 1');
        }
        if (sweep_flag !== 0 && sweep_flag !== 1) {
            throw new Error('sweep_flag must be 0 or 1');
        }
        // set new (x, y)
        x = x1;
        y = y1;

        // calculate desired ellipse parameters suitable for CanvasRenderingContext2D:ellipse()
        // see: https://www.w3.org/TR/SVG/implnote.html
        if (rx === 0 || ry === 0) {
            // special case described in section B.2.5. "Correction of out-of-range radii"
            // if rx === 0 or ry === 0, then treat this as a straight line from
            // (x1, y1) to (x2, y2) and stop.
            ctx.lineTo(x2, y2);
        } else {
            const angle_radians = angle * Math.PI / 180;
            const ca = Math.cos(angle_radians);
            const sa = Math.sin(angle_radians);
            const x1_prime =  ca*(x1 - x2)/2 + sa*(y1 - y2)/2;
            const y1_prime = -sa*(x1 - x2)/2 + ca*(y1 - y2)/2;
            // section B.2.5: "Correction of out-of-range radii":
            rx = Math.abs(rx);
            ry = Math.abs(ry);
            {
                const lambda = x1_prime*x1_prime/rx/rx + y1_prime*y1_prime/ry/ry;
                if (lambda > 1) {
                    const sqrt_lambda = Math.sqrt(lambda);
                    rx *= sqrt_lambda;
                    ry *= sqrt_lambda;
                    // rx and ry have both increased in value...
                }
            }
            // continue with calculating center, etc:
            const c_factor = ((large_arc_flag !== sweep_flag) ? 1 : -1) *
                             Math.sqrt( Math.max(
                                 0,
                                 ( (rx*rx*ry*ry - rx*rx*y1_prime*y1_prime - ry*ry*x1_prime*x1_prime) /
                                   (rx*rx*y1_prime*y1_prime + ry*ry*x1_prime*x1_prime) ) ) );
            const cx_prime = c_factor *  rx * y1_prime / ry;
            const cy_prime = c_factor * -ry * x1_prime / rx;
            const cx = (ca*cx_prime + -sa*cy_prime) + (x1 + x2)/2;
            const cy = (sa*cx_prime +  ca*cy_prime) + (y1 + y2)/2;
            const theta1 = vector_angle( 1, 0,
                                         (x1_prime - cx_prime)/rx, (y1_prime - cy_prime)/ry );
            const delta_theta_unadjusted = vector_angle( ( x1_prime - cx_prime)/rx, ( y1_prime - cy_prime)/ry,
                                                         (-x1_prime - cx_prime)/rx, (-y1_prime - cy_prime)/ry );
            const delta_theta = delta_theta_unadjusted +
                                ( (sweep_flag === 0 && delta_theta_unadjusted > 0)
                                  ? -2*Math.PI
                                  : ( (sweep_flag === 1 && delta_theta_unadjusted < 0)
                                      ? 2*Math.PI
                                      : 0 ) );
            // render using CanvasRenderingContext2D

            ctx.ellipse(cx, cy, rx, ry, angle_radians, theta1, theta1+delta_theta, (delta_theta < 0));
            //!!! Note: B.3. "Notes on generating high-precision geometry" is not implemented.
        }
        // set the new current point
        x = x2;
        y = y2;
    };

    // --- processing loop ---

    ctx.beginPath();

    let x = 0, y = 0;
    ctx.moveTo(x, y);

    // these track information necessary for implementing the "smooth" variants of cubic and quadratic curves
    let last_command:               undefined|string;
    let last_command_control_point: undefined|number[];

    const is_last_command_matching = (command_specifier_char: string): boolean => {
        const csclc = command_specifier_char.toLowerCase();
        switch (last_command) {
        case 'C': case 'c':
        case 'S': case 's': {
            return [ 'c', 's' ].includes(csclc);
        }
        case 'Q': case 'q':
        case 'T': case 't': {
            return [ 'q', 't' ].includes(csclc);
        }
        case undefined:
        default: {
            return false;
        }
        }
    };

    const get_smooth_curve_cp1 = (command_specifier_char: string): number[] => {
        if (is_last_command_matching(command_specifier_char)) {
            // return last_command_control_point reflected through the current point (x, y)
            return [
                2*x - (last_command_control_point?.[0] ?? 0),
                2*y - (last_command_control_point?.[1] ?? 0),
            ];
        } else {
            // return just the current point (x, y)
            return [ x, y ];
        }
    };

    for (;;) {
        skip_separators();
        if (command_idx >= commands.length) {
            break;
        }
        const command_specifier_char = commands[command_idx++];
        const is_command_relative = !!command_specifier_char.match(/^[a-z]/);  // lowercase command char implies relative

        switch (command_specifier_char) {
        case 'm':
        case 'M': {
            // move to
            for (let first_dataset = true; is_number_available(); first_dataset = false) {
                get_points_and_run_command(is_command_relative, 1, (points: Array<[number, number]>) => {
                    if (first_dataset) {
                        ctx.moveTo(...points[0]);
                    } else {
                        ctx.lineTo(...points[0]);
                    }
                    // set the new current point
                    ([x, y] = points[0]);
                });
            }
            break;
        };

        case 'l':
        case 'L': {
            // line to
            while (is_number_available()) {
                get_points_and_run_command(is_command_relative, 1, (points: Array<[number, number]>) => {
                    ctx.lineTo(...points[0]);
                    // set the new current point
                    ([x, y] = points[0]);
                });
            }
            break;
        };

        case 'h':
        case 'H': {
            // horizontal line to
            while (is_number_available()) {
                get_arguments_and_draw_h_or_v_line(is_command_relative, false);
            }
            break;
        };

        case 'v':
        case 'V': {
            // vertical line to
            while (is_number_available()) {
                get_arguments_and_draw_h_or_v_line(is_command_relative, true);
            }
            break;
        };

        case 'c':
        case 'C': {
            // cubic bezier curve
            while (is_number_available()) {
                get_points_and_run_command(is_command_relative, 3, (points: Array<[number, number]>) => {
                    ctx.bezierCurveTo(...points[0], ...points[1], ...points[2]);
                    // set the new current point
                    ([x, y] = points[2]);
                    // store info to support "smooth" variant of command
                    last_command_control_point = points[1];
                    last_command = command_specifier_char;  // for next curve combined in this single command, if any
                });
            }
            break;
        };

        case 's':
        case 'S': {
            // smooth cubic bezier curve
            while (is_number_available()) {
                const [ cp1_x, cp1_y ] = get_smooth_curve_cp1(command_specifier_char);
                get_points_and_run_command(is_command_relative, 2, (points: Array<[number, number]>) => {
                    ctx.bezierCurveTo(cp1_x, cp1_y, ...points[0], ...points[1]);
                    // set the new current point
                    ([x, y] = points[1]);
                    // store info to support "smooth" variant of command
                    last_command_control_point = points[0];
                    last_command = command_specifier_char;  // for next curve combined in this single command, if any
                });
            }
            break;
        };

        case 'q':
        case 'Q': {
            // cubic quadratic curve
            while (is_number_available()) {
                get_points_and_run_command(is_command_relative, 2, (points: Array<[number, number]>) => {
                    ctx.quadraticCurveTo(...points[0], ...points[1]);
                    // set the new current point
                    ([x, y] = points[1]);
                    // store info to support "smooth" variant of command
                    last_command_control_point = points[0];
                    last_command = command_specifier_char;  // for next curve combined in this single command, if any
                });
            }
            break;
        };

        case 't':
        case 'T': {
            // smooth quadratic bezier curve
            while (is_number_available()) {
                const [ cp1_x, cp1_y ] = get_smooth_curve_cp1(command_specifier_char);
                get_points_and_run_command(is_command_relative, 1, (points: Array<[number, number]>) => {
                    ctx.quadraticCurveTo(cp1_x, cp1_y, ...points[0]);
                    // set the new current point
                    ([x, y] = points[0]);
                    // store info to support "smooth" variant of command
                    last_command_control_point = [ cp1_x, cp1_y ];
                    last_command = command_specifier_char;  // for next curve combined in this single command, if any
                });
            }
            break;
        };

        case 'a':
        case 'A': {
            // elliptical arc curve
            while (is_number_available()) {
                get_arguments_and_run_elliptical_arc_curve_command(is_command_relative);
            }
            break;
        };

        case 'z':
        case 'Z': {
            ctx.closePath();
            break;
        };

        default:
            throw new Error(`[idx=${command_idx}]: parse error: unknown command character "${command_specifier_char}"`);
        }

        last_command = command_specifier_char;
    }
};
