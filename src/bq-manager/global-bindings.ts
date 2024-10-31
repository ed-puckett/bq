import * as commands from './commands';

/** return the initial menu specification
 *  @return {Object} menu specification
 */
export function get_menubar_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Clear document',  item: { command: 'clear-all'             } },
            '---',
            { label: 'Save',            item: { command: 'save'                  } },
            { label: 'Save as...',      item: { command: 'save-as'               } },
            { label: 'Export...',       item: { command: 'export'                } },
            '---',
            { label: 'Auto-eval',       item: { command: 'toggle-auto-eval'      } },
            '---',
            { label: 'Settings...',     item: { command: 'settings'              } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',            item: { command: 'eval-and-refocus'      } },
            { label: 'Eval and stay',   item: { command: 'eval'                  } },
            { label: 'Eval before',     item: { command: 'eval-before'           } },
            { label: 'Eval all',        item: { command: 'eval-all'              } },
            '---',
            { label: 'Stop cell',       item: { command: 'stop'                  } },
            { label: 'Stop all',        item: { command: 'stop-all'              } },
            '---',
            { label: 'Reset cell',      item: { command: 'reset'                 } },
            { label: 'Reset all',       item: { command: 'reset-all'             } },
            '---',
            { label: 'Focus up',        item: { command: 'focus-up'              } },
            { label: 'Focus down',      item: { command: 'focus-down'            } },
            '---',
            { label: 'Move up',         item: { command: 'move-up'               } },
            { label: 'Move down',       item: { command: 'move-down'             } },
            { label: 'Add before',      item: { command: 'add-before'            } },
            { label: 'Add after',       item: { command: 'add-after'             } },
            { label: 'Duplicate',       item: { command: 'duplicate'             } },
            { label: 'Delete',          item: { command: 'delete'                } },
        ] },

        { label: 'Type', collection: [
            { label: 'Plain text',      item: { command: 'set-type-plain'        } },
            { label: 'Markdown',        item: { command: 'set-type-markdown'     } },
            { label: 'TeX',             item: { command: 'set-type-tex'          } },
            { label: 'JavaScript',      item: { command: 'set-type-javascript'   } },
        ] },

        { label: 'View', collection: [
            { label: 'Normal',          item: { command: 'set-view-normal'       } },
            { label: 'Hide',            item: { command: 'set-view-hide'         } },
            { label: 'Full',            item: { command: 'set-view-full'         } },
            { label: 'None',            item: { command: 'set-view-none'         } },
            { label: 'Presentation',    item: { command: 'set-view-presentation' } },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',         item: { command: 'help',                 } },
        ] },
    ];
}

export function get_ellipsis_menu_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Clear document',  item: { command: 'clear-all'             } },
            '---',
            { label: 'Save',            item: { command: 'save'                  } },
            { label: 'Save as...',      item: { command: 'save-as'               } },
            { label: 'Export...',       item: { command: 'export'                } },
            '---',
            { label: 'Auto-eval',       item: { command: 'toggle-auto-eval'      } },
            '---',
            { label: 'Settings...',     item: { command: 'settings'              } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',            item: { command: 'eval-and-refocus'      } },
            { label: 'Eval and stay',   item: { command: 'eval'                  } },
            { label: 'Eval before',     item: { command: 'eval-before'           } },
            { label: 'Eval all',        item: { command: 'eval-all'              } },
            '---',
            { label: 'Stop cell',       item: { command: 'stop'                  } },
            { label: 'Stop all',        item: { command: 'stop-all'              } },
            '---',
            { label: 'Reset cell',      item: { command: 'reset'                 } },
            { label: 'Reset all',       item: { command: 'reset-all'             } },
            '---',
            { label: 'Focus up',        item: { command: 'focus-up'              } },
            { label: 'Focus down',      item: { command: 'focus-down'            } },
            '---',
            { label: 'Move up',         item: { command: 'move-up'               } },
            { label: 'Move down',       item: { command: 'move-down'             } },
            { label: 'Add before',      item: { command: 'add-before'            } },
            { label: 'Add after',       item: { command: 'add-after'             } },
            { label: 'Duplicate',       item: { command: 'duplicate'             } },
            { label: 'Delete',          item: { command: 'delete'                } },
        ] },

        { label: 'Type', collection: [
            { label: 'Plain text',      item: { command: 'set-type-plain'        } },
            { label: 'Markdown',        item: { command: 'set-type-markdown'     } },
            { label: 'TeX',             item: { command: 'set-type-tex'          } },
            { label: 'JavaScript',      item: { command: 'set-type-javascript'   } },
        ] },

        { label: 'View', collection: [
            { label: 'Normal',          item: { command: 'set-view-normal'       } },
            { label: 'Hide',            item: { command: 'set-view-hide'         } },
            { label: 'Full',            item: { command: 'set-view-full'         } },
            { label: 'None',            item: { command: 'set-view-none'         } },
            { label: 'Presentation',    item: { command: 'set-view-presentation' } },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',         item: { command: 'help',                 } },
        ] },
    ];
}


/** return the initial key map bindings
 *  @return {Object} mapping from command strings to arrays of triggering key sequences
 */
export function get_global_initial_key_map_bindings() {
    return {
        'reset':                 [ 'CmdOrCtrl-Shift-#' ],
        'reset-all':             [ 'CmdOrCtrl-Alt-Shift-#' ],
        'clear-all':             [ 'CmdOrCtrl-Shift-!' ],

        'cut':                   [ 'CmdOrCtrl-X' ],
        'copy':                  [ 'CmdOrCtrl-C' ],
        'paste':                 [ 'CmdOrCtrl-V' ],

        'save':                  [ 'CmdOrCtrl-S' ],
        'save-as':               [ 'CmdOrCtrl-Shift-S' ],
        'export':                [ 'CmdOrCtrl-Shift-E' ],

        'toggle-auto-eval':      [ 'CmdOrCtrl-Shift-A' ],

        'settings':              [ 'CmdOrCtrl-,' ],

        'eval':                  [ 'CmdOrCtrl-Enter' ],
        'eval-and-refocus':      [ 'Shift-Enter' ],
        'eval-before':           [ 'CmdOrCtrl-Shift-Enter' ],
        'eval-all':              [ 'CmdOrCtrl-Shift-Alt-Enter' ],

        'stop':                  [ 'CmdOrCtrl-Shift-$' ],
        'stop-all':              [ 'CmdOrCtrl-Shift-Alt-$' ],

        'focus-up':              [ 'Alt-Up' ],
        'focus-down':            [ 'Alt-Down' ],

        'move-up':               [ 'CmdOrCtrl-Alt-Up' ],
        'move-down':             [ 'CmdOrCtrl-Alt-Down' ],
        'add-before':            [ 'CmdOrCtrl-Alt-Shift-Up' ],
        'add-after':             [ 'CmdOrCtrl-Alt-Shift-Down' ],
        'duplicate':             [ 'CmdOrCtrl-Alt-Shift-:' ],
        'delete':                [ 'CmdOrCtrl-Alt-Backspace' ],

        'set-type-plain':        [ 'Alt-T t', 'Alt-T p' ],
        'set-type-markdown':     [ 'Alt-T m' ],
        'set-type-tex':          [ 'Alt-T x' ],
        'set-type-javascript':   [ 'Alt-T j' ],

        'set-view-normal':       [ 'Alt-V n' ],
        'set-view-hide':         [ 'Alt-V h' ],
        'set-view-full':         [ 'Alt-V f' ],
        'set-view-none':         [ 'Alt-V x' ],
        'set-view-presentation': [ 'Alt-V p' ],

        'help':                  [ 'F1' ],
    };
}

/** return global command bindings
 *  @return {Object} mapping from command strings to functions implementing that command
 * The handler functions are taken from the commands argument.
 */
export function get_global_command_bindings() {
    const command_bindings = {
        'reset':                 commands.command_handler__reset,
        'reset-all':             commands.command_handler__reset_all,
        'clear-all':             commands.command_handler__clear_all,

        'save':                  commands.command_handler__save,
        'save-as':               commands.command_handler__save_as,
        'export':                commands.command_handler__export,

        'toggle-auto-eval':      commands.command_handler__toggle_auto_eval,

        'settings':              commands.command_handler__show_settings_dialog,

        'cut':                   commands.command_handler__cut,
        'copy':                  commands.command_handler__copy,
        'paste':                 commands.command_handler__paste,

        'eval':                  commands.command_handler__eval,
        'eval-and-refocus':      commands.command_handler__eval_and_refocus,
        'eval-before':           commands.command_handler__eval_before,
        'eval-all':              commands.command_handler__eval_all,

        'stop':                  commands.command_handler__stop,
        'stop-all':              commands.command_handler__stop_all,

        'focus-up':              commands.command_handler__focus_up,
        'focus-down':            commands.command_handler__focus_down,

        'move-up':               commands.command_handler__move_up,
        'move-down':             commands.command_handler__move_down,
        'add-before':            commands.command_handler__add_before,
        'add-after':             commands.command_handler__add_after,
        'duplicate':             commands.command_handler__duplicate,
        'delete':                commands.command_handler__delete,

        'set-type-plain':        commands.command_handler__set_type_plain,
        'set-type-markdown':     commands.command_handler__set_type_markdown,
        'set-type-tex':          commands.command_handler__set_type_tex,
        'set-type-javascript':   commands.command_handler__set_type_javascript,

        'set-view-normal':       commands.command_handler__set_view_normal,
        'set-view-hide':         commands.command_handler__set_view_hide,
        'set-view-full':         commands.command_handler__set_view_full,
        'set-view-none':         commands.command_handler__set_view_none,
        'set-view-presentation': commands.command_handler__set_view_presentation,

        'help':                  commands.command_handler__show_help,
    };

    return command_bindings;
}
