//                    0    1      2      3      4      5      6      7      8
const units_1024 = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB' ];
const units_1000 = [ 'B', 'KB',  'MB',  'GB',  'TB',  'PB',  'EB',  'ZB',  'YB'  ];

const units_1024_max_width = units_1024.reduce<number>((max: number, label: string): number => (max >= label.length) ? max : label.length, -Infinity);
const units_1000_max_width = units_1000.reduce<number>((max: number, label: string): number => (max >= label.length) ? max : label.length, -Infinity);

export type FORMAT_SIZE_OPTIONS = {
    powers_of_2?: boolean,
    with_space?:  boolean,
    pad_units?:   boolean,
};

export const format_size = (size: number, options: FORMAT_SIZE_OPTIONS = {}) => {
    const {
        powers_of_2 = false,
        with_space  = false,
        pad_units   = false,
    } = options;
    if (typeof size !== 'number' || Number.isNaN(size)) {
        throw new TypeError('size must be a non-NaN number');
    }
    let units, divisor, max_width;
    if (powers_of_2) {
        units     = units_1024;
        divisor   = 1024;
        max_width = units_1024_max_width;
    } else {
        units     = units_1000;
        divisor   = 1000;
        max_width = units_1000_max_width;
    }
    const negative = (size < 0);
    let n = negative ? -size : size;
    let units_index = 0;
    for ( ; ; units_index++) {
        if (n < divisor) {
            break;
        }
        if (units_index >= units.length-1) {
            break;  // units overflow
        }
        n /= divisor;
    }

    const decimals =
        Number.isInteger(n) ? 0
        : (n < 10) ? 1
        : 0;
    const units_label = pad_units
        ? units[units_index].padEnd(max_width)
        : units[units_index];
    return `${negative ? '-' : ''}${n.toFixed(decimals)}${with_space ? ' ' : ''}${units_label}`;
}

export const format_time = (time: Date, full: boolean = false): string => {
    const formatter = new Intl.DateTimeFormat(undefined, {
        year:   "numeric",
        month:  "short",
        day:    "2-digit",
        hour:   "2-digit", hour12: false,
        minute: "2-digit",
        second: "2-digit",
    });
    const parts = formatter.formatToParts(time)
        .reduce( (acc: any, desc: any) => { acc[desc.type] = desc.value; return acc },
                 {} );
    if (full) {
        return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
    } else {
        const days_from_now = Math.abs(Date.now() - time.getTime()) / (24 * 60 * 60 * 1000);
        return (days_from_now < 1)
            ? `${parts.hour}:${parts.minute}:${parts.second}`
            : `${parts.year}-${parts.month}-${parts.day}`;
    }
};
