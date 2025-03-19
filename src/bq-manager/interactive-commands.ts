// === COMMAND HANDLERS ===

import {
    BqManager,
} from './_';

import {
    CommandContext,
} from 'lib/ui/command-context';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    ConfirmDialog,
} from 'lib/ui/dialog/_';


// _scroll_target_into_view() is used by some commands to scroll the active cell
// into view before performing the command.
function _scroll_target_into_view(command_context: CommandContext<BqManager>) {
    if (!(command_context.target instanceof BqCellElement)) {
        console.warn('internal function _scroll_target_into_view(): command_context.target is not a cell', command_context);
    } else {
        command_context.dm.active_cell?.scroll_into_view(true);
    }
}


// === INTERACTIVE COMMAND HANDLER IMPLEMENTATIONS ===

// These interactive_command__* functions each return a boolean.  The return value
// is true iff the command was successfully handled.  It is assumed that
// command_context.target === command_context.dm.active_cell on entry.


export async function interactive_command__clear_all(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    if (!await ConfirmDialog.run('Clear document?')) {
        command_context.dm.active_cell?.focus();
        return false;
    }
    return command_context.dm.command__clear_all(command_context);
}

export async function interactive_command__save(command_context: CommandContext<BqManager>): Promise<boolean> {
    return command_context.dm.command__save(command_context);
}

export async function interactive_command__save_as(command_context: CommandContext<BqManager>): Promise<boolean> {
    return command_context.dm.command__save_as(command_context);
}

export async function interactive_command__export(command_context: CommandContext<BqManager>): Promise<boolean> {
    return command_context.dm.command__export(command_context);
}


export function interactive_command__toggle_auto_eval(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__toggle_auto_eval(command_context);
}

export function interactive_command__show_settings_dialog(command_context: CommandContext<BqManager>): boolean {
    return command_context.dm.command__show_settings_dialog(command_context);
}

/** eval target cell
 *  @return {Boolean} true iff command successfully handled
 */
export async function interactive_command__eval(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (!command_context.dm.interactive) {
        return false;
    }
    _scroll_target_into_view(command_context);
    return command_context.dm.command__eval(command_context);
}

/** eval target cell and refocus to next cell (or a new one if at the end of the document)
 *  @return {Boolean} true iff command successfully handled
 */
export async function interactive_command__eval_and_refocus(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (!command_context.dm.interactive) {
        return false;
    }
    _scroll_target_into_view(command_context);
    return command_context.dm.command__eval_and_refocus(command_context);
}

/** reset global eval context and then eval all cells in the document
 *  from the beginning up to but not including the target cell.
 *  @return {Boolean} true iff command successfully handled
 */
export async function interactive_command__eval_before(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    _scroll_target_into_view(command_context);
    return command_context.dm.command__eval_before(command_context);
}

/** stop all running evaluations, reset global eval context and then eval all cells in the document
 *  from first to last, and set focus to the last.
 *  @return {Boolean} true iff command successfully handled
 */
export async function interactive_command__eval_all(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    _scroll_target_into_view(command_context);
    return command_context.dm.command__eval_all(command_context);
}

/** stop evaluation for the target cell.
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__stop(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    return command_context.dm.command__stop(command_context);
}

/** stop all running evaluations.
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__stop_all(command_context: CommandContext<BqManager>): boolean {
    return command_context.dm.command__stop_all(command_context);
}

export function interactive_command__reset(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__reset(command_context);
}

export function interactive_command__reset_all(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__reset_all(command_context);
}

export function interactive_command__focus_up(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__focus_up(command_context);
}

export function interactive_command__focus_down(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__focus_down(command_context);
}

export function interactive_command__move_up(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__move_up(command_context);
}

export function interactive_command__move_down(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__move_down(command_context);
}

export function interactive_command__add_before(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__add_before(command_context);
}

export function interactive_command__add_after(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__add_after(command_context);
}

export function interactive_command__duplicate(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__duplicate(command_context);
}

export async function interactive_command__delete(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    return command_context.dm.command__delete(command_context);
}

export function interactive_command__toggle_show_full(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__toggle_show_full(command_context);
}

export function interactive_command__toggle_show_in_presentation(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__toggle_show_in_presentation(command_context);
}

/** set the target cell's type to "markdown".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_type_markdown(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__set_type_markdown(command_context);
}

/** set the target cell's type to "latex".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_type_latex(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__set_type_latex(command_context);
}

/** set the target cell's type to "javascript".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_type_javascript(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__set_type_javascript(command_context);
}

/** set the target cell's type to "plain".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_type_plain(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    return command_context.dm.command__set_type_plain(command_context);
}

/** set the document view to "normal".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_view_normal(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    return command_context.dm.command__set_view_normal(command_context);
}

/** set the document view to "hide".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_view_hide(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    return command_context.dm.command__set_view_hide(command_context);
}

/** set the document view to "full".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_view_full(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    return command_context.dm.command__set_view_full(command_context);
}

/** set the document view to "none".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_view_none(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    return command_context.dm.command__set_view_none(command_context);
}

/** set the document view to "presentation".
 *  @return {Boolean} true iff command successfully handled
 */
export function interactive_command__set_view_presentation(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    return command_context.dm.command__set_view_presentation(command_context);
}

export function interactive_command__show_help(command_context: CommandContext<BqManager>): boolean {
    return command_context.dm.command__show_help(command_context);
}
