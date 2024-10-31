// @ts-ignore  // types not available for the imported module
import { v4 } from 'uuid';

export function uuidv4(): string {
    return v4();
}

export function generate_object_id(): string {
    // html element ids cannot start with a number
    // (if it does, document.querySelector throws error: '... is not a valid selector')
    return `id-${uuidv4()}`;
}

export function generate_uuid(): string {
    return uuidv4();
}
