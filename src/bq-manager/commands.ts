// === COMMAND HANDLERS ===

import {
    BqManager,
} from './_';

import {
    BqCellElement,
} from 'src/bq-cell-element/_';

import {
    CommandContext,
} from 'lib/ui/command-context';

import {
    move_node,
} from 'lib/ui/dom-tools';

import {
    ConfirmDialog,
} from 'lib/ui/dialog/_';

import {
    cell_view_attribute_name,
    cell_view_values_default,
    get_auto_eval,
    set_auto_eval,
} from 'src/init';

import {
    SettingsDialog,
} from './settings-dialog/_';

import {
    open_help_window,
} from 'src/help-window/_';


// _scroll_target_into_view() is used by some commands to scroll the active cell
// into view before performing the command.
function _scroll_target_into_view(command_context: CommandContext<BqManager>) {
    if (!(command_context.target instanceof BqCellElement)) {
        console.warn('internal function _scroll_target_into_view(): command_context.target is not a cell', command_context);
    } else {
        command_context.dm.active_cell?.scroll_into_view(true);
    }
}


// These command_handler__* functions each return a boolean.  The return value
// is true iff the command was successfully handled.  It is assumed that
// command_context.target === command_context.dm.active_cell on entry.


export async function command_handler__clear_all(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    if (!await ConfirmDialog.run('Clear document?')) {
        command_context.dm.active_cell?.focus();
        return false;
    }
    command_context.dm.clear();
    return true;
}

export async function command_handler__save(command_context: CommandContext<BqManager>): Promise<boolean> {
    return command_context.dm.perform_save();
}

export async function command_handler__save_as(command_context: CommandContext<BqManager>): Promise<boolean> {
    return command_context.dm.perform_save(true);
}

export async function command_handler__export(command_context: CommandContext<BqManager>): Promise<boolean> {
    return command_context.dm.perform_save(true, true);
}


export function command_handler__toggle_auto_eval(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    const new_auto_eval_setting = !get_auto_eval();
    set_auto_eval(new_auto_eval_setting);
    command_context.dm.set_structure_modified();
    command_context.dm.notification_manager.add(`auto-eval ${new_auto_eval_setting ? 'on' : 'off'}`);
    return true;
}

export function command_handler__show_settings_dialog(command_context: CommandContext<BqManager>): boolean {
    SettingsDialog.run();
    return true;
}

/** eval target cell
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (!command_context.dm.interactive) {
        return false;
    }
    _scroll_target_into_view(command_context);
    const cell = command_context.target;
    if (!(cell instanceof BqCellElement)) {
        return false;
    } else {
        command_context.dm.set_structure_modified();
        try {
            await command_context.dm.invoke_renderer_for_type(cell.type, undefined, cell);
        } catch (error: unknown) {
            console.error('error rendering cell', error, cell);
            return false;
        }
        return true;
    }
}

/** eval target cell and refocus to next cell (or a new one if at the end of the document)
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval_and_refocus(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (!command_context.dm.interactive) {
        return false;
    }
    _scroll_target_into_view(command_context);
    const eval_result = await command_handler__eval(command_context);
    if (!eval_result) {
        return false;
    } else {
        const adjacent_cell = command_context.dm.adjacent_cell(command_context.target as BqCellElement, true);
        const next_cell = adjacent_cell
            ? adjacent_cell
            : (command_context.dm.in_presentation_view ? undefined : command_context.dm.create_cell());
        next_cell?.scroll_into_view(true);
        return true;
    }
}

async function multi_eval_helper(command_context: CommandContext<BqManager>, eval_all: boolean = false): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    _scroll_target_into_view(command_context);
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        return eval_all
            ? command_context.dm.render_cells()
            : command_context.dm.render_cells(command_context.target);
    }
}

/** reset global eval context and then eval all cells in the document
 *  from the beginning up to but not including the target cell.
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval_before(command_context: CommandContext<BqManager>): Promise<boolean> {
    return multi_eval_helper(command_context, false);
}

/** stop all running evaluations, reset global eval context and then eval all cells in the document
 *  from first to last, and set focus to the last.
 *  @return {Boolean} true iff command successfully handled
 */
export async function command_handler__eval_all(command_context: CommandContext<BqManager>): Promise<boolean> {
    return multi_eval_helper(command_context, true);
}

/** stop evaluation for the active cell.
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__stop(command_context: CommandContext<BqManager>): boolean {
    _scroll_target_into_view(command_context);
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        command_context.target.stop();
        return true;
    }
}

/** stop all running evaluations.
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__stop_all(command_context: CommandContext<BqManager>): boolean {
    command_context.dm.stop();
    return true;
}

export function command_handler__reset(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        command_context.target.reset();
        command_context.dm.set_structure_modified();
        return true;
    }
}

export function command_handler__reset_all(command_context: CommandContext<BqManager>): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    command_context.dm.reset();
    return true;
}

export function command_handler__focus_up(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        const focus_cell = command_context.dm.adjacent_cell(command_context.target, false);
        if (!focus_cell) {
            return false;
        } else {
            focus_cell.scroll_into_view(true);
            return true;
        }
    }
}

export function command_handler__focus_down(command_context: CommandContext<BqManager>): boolean {
    if (!command_context.dm.interactive) {
        return false;
    }
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        const focus_cell = command_context.dm.adjacent_cell(command_context.target, true);
        if (!focus_cell) {
            return false;
        } else {
            focus_cell.scroll_into_view(true);
            return true;
        }
    }
}

function move_helper(command_context: CommandContext<BqManager>, move_down: boolean): boolean {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        const cell = command_context.target;
        let before = command_context.dm.adjacent_cell(cell, move_down);
        if (!before) {
            return false;
        } else {
            if (move_down) {
                before = command_context.dm.adjacent_cell(before, move_down);
            }
            const parent = before ? before.parentElement : command_context.dm.cell_parent;
            move_node(cell, { parent, before });
            // now move associated output elements, if any
            // note that we support multiple output elements per cell, even
            // though there is usually only one.
            const output_elements = [ ...document.querySelectorAll(cell.get_output_element_selector()) ];
            for (const oe of output_elements.toReversed()) {  // reverse because assuming output elements follow cell
                const oe_next_sibling = oe.nextSibling;
                // move newline text node, if any, following output element, too.
                // it is included for formatting....
                if (oe_next_sibling && oe_next_sibling.nodeType === Node.TEXT_NODE && oe_next_sibling.nodeValue === '\n') {
                    move_node(oe_next_sibling, {
                        parent,
                        before: cell.nextElementSibling,
                    });
                }
                // now move the output element
                // note that we are moving these nodes in reverse order
                // because they are being moved releative to cell.nextElementSibling
                move_node(oe, {
                    parent,
                    before: cell.nextSibling,
                });
            }
            cell.scroll_into_view(true);
            command_context.dm.set_structure_modified();
            return true;
        }
    }
}

export function command_handler__move_up(command_context: CommandContext<BqManager>): boolean {
    return move_helper(command_context, false);
}

export function command_handler__move_down(command_context: CommandContext<BqManager>): boolean {
    return move_helper(command_context, true);
}

function add_cell_helper(command_context: CommandContext<BqManager>, add_before: boolean, duplicate: boolean = false) {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        const current_cell = command_context.target;
        command_context.dm.set_structure_modified();
        const this_cell = command_context.target;
        const before = add_before
            ? this_cell
            : command_context.dm.adjacent_cell(this_cell, true);
        const parent = before ? before.parentElement : command_context.dm.cell_parent;
        const new_cell = command_context.dm.create_cell({ before, parent });
        if (!new_cell) {
            return false;
        } else {
            new_cell.type = current_cell.type;
            if (duplicate) {
                new_cell.set_text(current_cell.get_text());
            }
            new_cell.scroll_into_view(true);
            return true;
        }
    }
}

export function command_handler__add_before(command_context: CommandContext<BqManager>): boolean {
    return add_cell_helper(command_context, true);
}

export function command_handler__add_after(command_context: CommandContext<BqManager>): boolean {
    return add_cell_helper(command_context, false);
}

export function command_handler__duplicate(command_context: CommandContext<BqManager>): boolean {
    return add_cell_helper(command_context, false, true);
}

export async function command_handler__delete(command_context: CommandContext<BqManager>): Promise<boolean> {
    if (command_context.dm.in_presentation_view) {
        return false;
    }
    if (!(command_context.target instanceof BqCellElement)) {
        return false;
    } else {
        command_context.dm.set_structure_modified();
        const cell = command_context.target;
        if (cell.get_text().trim().length > 0 || document.querySelectorAll(cell.get_output_element_selector()).length > 0) {
            const ok = await ConfirmDialog.run('Cannot undo delete of cell and output element.\nContinue?');
            if (!ok) {
                cell.focus();
                return false;
            }
        }
        let next_cell = command_context.dm.adjacent_cell(cell, true) ?? command_context.dm.adjacent_cell(cell, false);
        cell.reset();  // stop cell and remove output element, if any
        cell.remove();
        if (!next_cell) {
            next_cell = command_context.dm.create_cell();
        }
        next_cell.scroll_into_view(true);
        return true;
    }
}

function set_type_helper(command_context: CommandContext<BqManager>, type: string) {
    if (!command_context.dm.interactive) {
        return false;
    }
    command_context.dm.set_structure_modified();
    _scroll_target_into_view(command_context);
    const cell = command_context.target;
    if (!(cell instanceof BqCellElement)) {
        return false;
    } else {
        cell.type = type;
        return true;
    }
}

/** set the active cell's type to "markdown".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_type_markdown(command_context: CommandContext<BqManager>): boolean {
    return set_type_helper(command_context, 'markdown');
}

/** set the active cell's type to "tex".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_type_tex(command_context: CommandContext<BqManager>): boolean {
    return set_type_helper(command_context, 'tex');
}

/** set the active cell's type to "javascript".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_type_javascript(command_context: CommandContext<BqManager>): boolean {
    return set_type_helper(command_context, 'javascript');
}

/** set the active cell's type to "plain".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_type_plain(command_context: CommandContext<BqManager>): boolean {
    return set_type_helper(command_context, 'plain');
}

function set_view_helper(command_context: CommandContext<BqManager>, view: string): boolean {
    command_context.dm.set_structure_modified();
    _scroll_target_into_view(command_context);
    if (view === cell_view_values_default) {
        document.documentElement.removeAttribute(cell_view_attribute_name);
    } else {
        document.documentElement.setAttribute(cell_view_attribute_name, view);
    }
    return true;
}

/** set the document view to "normal".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_normal(command_context: CommandContext<BqManager>): boolean {
    return set_view_helper(command_context, 'normal');
}

/** set the document view to "hide".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_hide(command_context: CommandContext<BqManager>): boolean {
    return set_view_helper(command_context, 'hide');
}

/** set the document view to "full".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_full(command_context: CommandContext<BqManager>): boolean {
    return set_view_helper(command_context, 'full');
}

/** set the document view to "none".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_none(command_context: CommandContext<BqManager>): boolean {
    return set_view_helper(command_context, 'none');
}

/** set the document view to "presentation".
 *  @return {Boolean} true iff command successfully handled
 */
export function command_handler__set_view_presentation(command_context: CommandContext<BqManager>): boolean {
    return set_view_helper(command_context, 'presentation');
}

export function command_handler__show_help(command_context: CommandContext<BqManager>): boolean {
    open_help_window();
    return true;
}
