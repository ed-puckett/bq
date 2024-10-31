export function get_obj_path(obj: object, path: string[]): object {
    for (const segment of path) {
        obj = ((obj as any) ?? {})[segment];
    }
    return obj;
}

export function set_obj_path(obj: object, path: string[], value: any): void {
    if (path.length < 1) {
        throw new Error('path must contain at least one segment');
    }
    for (const segment of path.slice(0, -1)) {
        if (typeof (obj as any)[segment] === 'undefined') {
            (obj as any)[segment] = {};
        }
        obj = (obj as any)[segment];
    }
    (obj as any)[path.slice(-1)[0]] = value;
}
