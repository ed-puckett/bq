import {
    KeySpec,
} from 'lib/ui/key/_';


export type CommandContext<DocumentManager> = {
    dm:        DocumentManager,
    command:   string,
    target?:   null|EventTarget,
    key_spec?: null|KeySpec,
};
