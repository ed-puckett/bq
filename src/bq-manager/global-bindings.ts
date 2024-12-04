import * as interactive_commands from './interactive-commands';

/** return the initial menu specification
 *  @return {Object} menu specification
 */
export function get_menubar_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Clear document',       item: { command: 'clear-all'                   } },
            '---',
            { label: 'Save',                 item: { command: 'save'                        } },
            { label: 'Save as...',           item: { command: 'save-as'                     } },
            { label: 'Export...',            item: { command: 'export'                      } },
            '---',
            { label: 'Auto-eval',            item: { command: 'toggle-auto-eval'            } },
            '---',
            { label: 'Settings...',          item: { command: 'settings'                    } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',                 item: { command: 'eval-and-refocus'            } },
            { label: 'Eval and stay',        item: { command: 'eval'                        } },
            { label: 'Eval before',          item: { command: 'eval-before'                 } },
            { label: 'Eval all',             item: { command: 'eval-all'                    } },
            '---',
            { label: 'Stop cell',            item: { command: 'stop'                        } },
            { label: 'Stop all',             item: { command: 'stop-all'                    } },
            '---',
            { label: 'Reset cell',           item: { command: 'reset'                       } },
            { label: 'Reset all',            item: { command: 'reset-all'                   } },
            '---',
            { label: 'Focus up',             item: { command: 'focus-up'                    } },
            { label: 'Focus down',           item: { command: 'focus-down'                  } },
            '---',
            { label: 'Move up',              item: { command: 'move-up'                     } },
            { label: 'Move down',            item: { command: 'move-down'                   } },
            { label: 'Add before',           item: { command: 'add-before'                  } },
            { label: 'Add after',            item: { command: 'add-after'                   } },
            { label: 'Duplicate',            item: { command: 'duplicate'                   } },
            { label: 'Delete',               item: { command: 'delete'                      } },
            '---',
            { label: 'Show full',            item: { command: 'toggle-show-full'            } },
            { label: 'Show in presentation', item: { command: 'toggle-show-in-presentation' } },
        ] },

        { label: 'Type', collection: [
            { label: 'Plain text',           item: { command: 'set-type-plain'              } },
            { label: 'Markdown',             item: { command: 'set-type-markdown'           } },
            { label: 'LaTeX',                item: { command: 'set-type-latex'              } },
            { label: 'JavaScript',           item: { command: 'set-type-javascript'         } },
        ] },

        { label: 'View', collection: [
            { label: 'Normal',               item: { command: 'set-view-normal'             } },
            { label: 'Hide',                 item: { command: 'set-view-hide'               } },
            { label: 'Full',                 item: { command: 'set-view-full'               } },
            { label: 'None',                 item: { command: 'set-view-none'               } },
            { label: 'Presentation',         item: { command: 'set-view-presentation'       } },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',              item: { command: 'help',                       } },
        ] },
    ];
}

export function get_ellipsis_menu_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Clear document',       item: { command: 'clear-all'                   } },
            '---',
            { label: 'Save',                 item: { command: 'save'                        } },
            { label: 'Save as...',           item: { command: 'save-as'                     } },
            { label: 'Export...',            item: { command: 'export'                      } },
            '---',
            { label: 'Auto-eval',            item: { command: 'toggle-auto-eval'            } },
            '---',
            { label: 'Settings...',          item: { command: 'settings'                    } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',                 item: { command: 'eval-and-refocus'            } },
            { label: 'Eval and stay',        item: { command: 'eval'                        } },
            { label: 'Eval before',          item: { command: 'eval-before'                 } },
            { label: 'Eval all',             item: { command: 'eval-all'                    } },
            '---',
            { label: 'Stop cell',            item: { command: 'stop'                        } },
            { label: 'Stop all',             item: { command: 'stop-all'                    } },
            '---',
            { label: 'Reset cell',           item: { command: 'reset'                       } },
            { label: 'Reset all',            item: { command: 'reset-all'                   } },
            '---',
            { label: 'Focus up',             item: { command: 'focus-up'                    } },
            { label: 'Focus down',           item: { command: 'focus-down'                  } },
            '---',
            { label: 'Move up',              item: { command: 'move-up'                     } },
            { label: 'Move down',            item: { command: 'move-down'                   } },
            { label: 'Add before',           item: { command: 'add-before'                  } },
            { label: 'Add after',            item: { command: 'add-after'                   } },
            { label: 'Duplicate',            item: { command: 'duplicate'                   } },
            { label: 'Delete',               item: { command: 'delete'                      } },
            '---',
            { label: 'Show full',            item: { command: 'toggle-show-full'            } },
            { label: 'Show in presentation', item: { command: 'toggle-show-in-presentation' } },
        ] },

        { label: 'Type', collection: [
            { label: 'Plain text',           item: { command: 'set-type-plain'              } },
            { label: 'Markdown',             item: { command: 'set-type-markdown'           } },
            { label: 'LaTeX',                item: { command: 'set-type-latex'              } },
            { label: 'JavaScript',           item: { command: 'set-type-javascript'         } },
        ] },

        { label: 'View', collection: [
            { label: 'Normal',               item: { command: 'set-view-normal'             } },
            { label: 'Hide',                 item: { command: 'set-view-hide'               } },
            { label: 'Full',                 item: { command: 'set-view-full'               } },
            { label: 'None',                 item: { command: 'set-view-none'               } },
            { label: 'Presentation',         item: { command: 'set-view-presentation'       } },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',              item: { command: 'help',                       } },
        ] },
    ];
}


/** return the initial key map bindings
 *  @return {Object} mapping from command strings to arrays of triggering key sequences
 */
export function get_global_initial_key_map_bindings() {
    return {
        'reset':                       [ 'CmdOrCtrl-Shift-#' ],
        'reset-all':                   [ 'CmdOrCtrl-Alt-Shift-#' ],
        'clear-all':                   [ 'CmdOrCtrl-Shift-!' ],

        'save':                        [ 'CmdOrCtrl-S' ],
        'save-as':                     [ 'CmdOrCtrl-Shift-S' ],
        'export':                      [ 'CmdOrCtrl-Shift-E' ],

        'toggle-auto-eval':            [ 'CmdOrCtrl-Shift-A' ],

        'settings':                    [ 'CmdOrCtrl-,' ],

        'eval':                        [ 'CmdOrCtrl-Enter' ],
        'eval-and-refocus':            [ 'Shift-Enter' ],
        'eval-before':                 [ 'CmdOrCtrl-Shift-Enter' ],
        'eval-all':                    [ 'CmdOrCtrl-Shift-Alt-Enter' ],

        'stop':                        [ 'CmdOrCtrl-Shift-$' ],
        'stop-all':                    [ 'CmdOrCtrl-Shift-Alt-$' ],

        'focus-up':                    [ 'Alt-Up' ],
        'focus-down':                  [ 'Alt-Down' ],

        'move-up':                     [ 'CmdOrCtrl-Alt-Up' ],
        'move-down':                   [ 'CmdOrCtrl-Alt-Down' ],
        'add-before':                  [ 'CmdOrCtrl-Alt-Shift-Up' ],
        'add-after':                   [ 'CmdOrCtrl-Alt-Shift-Down' ],
        'duplicate':                   [ 'CmdOrCtrl-Alt-Shift-:' ],
        'delete':                      [ 'CmdOrCtrl-Alt-Backspace' ],

        'toggle-show-full':            [ 'Alt-S f' ],
        'toggle-show-in-presentation': [ 'Alt-S p' ],

        'set-type-plain':              [ 'Alt-T t', 'Alt-T p' ],
        'set-type-markdown':           [ 'Alt-T m' ],
        'set-type-latex':              [ 'Alt-T l' ],
        'set-type-javascript':         [ 'Alt-T j' ],

        'set-view-normal':             [ 'Alt-V n' ],
        'set-view-hide':               [ 'Alt-V h' ],
        'set-view-full':               [ 'Alt-V f' ],
        'set-view-none':               [ 'Alt-V x' ],
        'set-view-presentation':       [ 'Alt-V p' ],

        'help':                        [ 'F1' ],
    };
}

/** return global command bindings
 *  @return {Object} mapping from command strings to functions implementing that command
 */
export function get_global_command_bindings() {
    const command_bindings = {
        'reset':                       interactive_commands.interactive_command__reset,
        'reset-all':                   interactive_commands.interactive_command__reset_all,
        'clear-all':                   interactive_commands.interactive_command__clear_all,

        'save':                        interactive_commands.interactive_command__save,
        'save-as':                     interactive_commands.interactive_command__save_as,
        'export':                      interactive_commands.interactive_command__export,

        'toggle-auto-eval':            interactive_commands.interactive_command__toggle_auto_eval,

        'settings':                    interactive_commands.interactive_command__show_settings_dialog,

        'eval':                        interactive_commands.interactive_command__eval,
        'eval-and-refocus':            interactive_commands.interactive_command__eval_and_refocus,
        'eval-before':                 interactive_commands.interactive_command__eval_before,
        'eval-all':                    interactive_commands.interactive_command__eval_all,

        'stop':                        interactive_commands.interactive_command__stop,
        'stop-all':                    interactive_commands.interactive_command__stop_all,

        'focus-up':                    interactive_commands.interactive_command__focus_up,
        'focus-down':                  interactive_commands.interactive_command__focus_down,

        'move-up':                     interactive_commands.interactive_command__move_up,
        'move-down':                   interactive_commands.interactive_command__move_down,
        'add-before':                  interactive_commands.interactive_command__add_before,
        'add-after':                   interactive_commands.interactive_command__add_after,
        'duplicate':                   interactive_commands.interactive_command__duplicate,
        'delete':                      interactive_commands.interactive_command__delete,

        'toggle-show-full':            interactive_commands.interactive_command__toggle_show_full,
        'toggle-show-in-presentation': interactive_commands.interactive_command__toggle_show_in_presentation,

        'set-type-plain':              interactive_commands.interactive_command__set_type_plain,
        'set-type-markdown':           interactive_commands.interactive_command__set_type_markdown,
        'set-type-latex':              interactive_commands.interactive_command__set_type_latex,
        'set-type-javascript':         interactive_commands.interactive_command__set_type_javascript,

        'set-view-normal':             interactive_commands.interactive_command__set_view_normal,
        'set-view-hide':               interactive_commands.interactive_command__set_view_hide,
        'set-view-full':               interactive_commands.interactive_command__set_view_full,
        'set-view-none':               interactive_commands.interactive_command__set_view_none,
        'set-view-presentation':       interactive_commands.interactive_command__set_view_presentation,

        'help':                        interactive_commands.interactive_command__show_help,
    };

    return command_bindings;
}
