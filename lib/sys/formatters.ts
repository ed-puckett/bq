//                    0    1      2      3      4      5      6      7      8
const units_1024 = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB' ];
const units_1000 = [ 'B', 'KB',  'MB',  'GB',  'TB',  'PB',  'EB',  'ZB',  'YB'  ];

export const format_size = (size: number, powers_of_2: boolean = false, with_space: boolean = false) => {
    if (typeof size !== 'number' || Number.isNaN(size)) {
        throw new TypeError('size must be a non-NaN number');
    }
    let units, divisor;
    if (powers_of_2) {
        units   = units_1024;
        divisor = 1024;
    } else {
        units   = units_1000;
        divisor = 1000;
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
    return `${negative ? '-' : ''}${n.toFixed(decimals)}${with_space ? ' ' : ''}${units[units_index]}`;
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
