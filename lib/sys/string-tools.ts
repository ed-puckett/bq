// === ESCAPE TEXT AND HTML ===

export function escape_unescaped_$(s: string): string {
    // Note: add $ to the end and then remove the last two characters ('\\$') from
    // the result.  Why?  Because the RE does not work correctly when the remaining
    // part after a match does not contain a non-escaped $.  This workaround works
    // correctly even if s ends with \.
    const re = /((\\?.)*?)\$/g;
    return (s + '$').replace(re, (...args) => `${args[1]}\\$`).slice(0, -2);
}

/** escape_for_html(s)
 *  convert all '<' and '>' to their corresponding HTML entities
 *  @param {string} string to be converted
 *  @return {string} converted string
 */
export function escape_for_html(s: string): string {
    return s.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}


// === STRING LITERAL ===

/** make_string_literal(s)
 *  @param {string} s
 *  @param {boolean} enclose_in_double_quotes
 *  @return {string} string representation of a string literal for s
 */
export function make_string_literal(s: string, enclose_in_double_quotes: boolean = false): string {
    return enclose_in_double_quotes
        ? `"${[ ...s ].map(s => s === '"' ? '\\"' : s).join('')}"`
        : `'${[ ...s ].map(s => s === "'" ? "\\'" : s).join('')}'`
    ;
}
