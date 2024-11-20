import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';

import {
    generate_uuid,
} from 'lib/sys/uuid';

import {
    db_key_themes,
    storage_db,
} from './storage';

import {
    create_element,
    clear_element,
} from 'lib/ui/dom-tools';

import {
    get_settings,
    theme_system,
    theme_light,
    theme_dark,
    settings_updated_events,
} from './settings';


const theme_name_validation_re      = /^[A-Za-z_-][A-Za-z0-9_-]*$/;
const theme_prop_name_validation_re = /^--theme-[A-Za-z_-][A-Za-z0-9_-]*$/;

const root_element = document.documentElement;
export const root_element_theme_attribute = 'data-theme';


/*
  === THEMES STRATEGY ===

  Custom Themes Issues
  - THEME NAMES MAY COME FROM USER INPUT, SO DO NOT USE THEM AS KEYS IN OBJECTS
  - storage is segregated by different document URLs, so custom themes will not be shared
    among different pages.

  Storage
  - themes with standard theme names should not be stored because that would
    prevent future updates to the standard themes from being seen by the user
  - themes with standard theme names are stored if they have been modified
  - storage is read once at initialization.  This means that other instances'
    subsequent modifications will not be seen until re-initialization.  //!!!
  - the values read from storage (and subsequent updates) are stored in the
    variable _current_themes_settings.
  - themes read from storage are "adjusted" by filling in missing (standard)
    props from default_standard_theme.  This clumsily brings old themes forward
    when the standard theme properties extended.  Note that "obsolete" theme
    properties are left alone in case the omission is temporary.
  - this all needs to be reviewed when/if user-modified theme settings are
    implemented.

  External Interface
  - themes returned to the user via get_themes_settings() start with the
    themes specified by standard_theme_names first, then any remaining themes.
    Themes from storage override standard themes.
  - themes sent to update_themes_settings() will be filtered to remove
    unmodified standard themes before putting them storage.

  Root Element
  - root_element = document.documentElement
  - dark_mode_media_query_list = globalThis.matchMedia("(prefers-color-scheme: dark)");
  - if dark_mode_media_query_list.matches then the attribute
    root_element_theme_attribute ("data-theme") is set to theme_dark ("dark")
    on the root_element.  Otherwise, the attribute root_element_theme_attribute
    is removed from the root_element.
  - an event listener listening for "change" is set on
    dark_mode_media_query_list so that system-wide changes
    trigger changes to the attribute root_element_theme_attribute on the
    root_element.
  - therefore, it is sufficient to test the presence (indicating "dark")
    or absence (indicating "light", the default) of the attribute
    root_element_theme_attribute on the root_element.
  - The document setting overrides the system-wide preference.

  Style Element
  - a <style> element with definitions for the theme variables for each
    different theme setting.  When the root element's theme attribute
    (root_element_theme_attribute) is changed, the CSS custom variables
    are automatically adjusted.
*/


// === THEME STYLES ===

const theme_property_name_documentation = `\
/*
  --- THEME PROPERTIES ---

  ELEMENT TYPE:                                            ELEMENT COLOR TYPE:
  si -- system interaction element (e.g., dialog, menu)    bg -- background color
  ui -- user interaction element (e.g., body, bq-cell)     fg -- foreground color
  ou -- output element                                     ef -- error foreground color
                                                           df -- dim foreground color
                                                           hb -- highlight background color
                                                           rc -- rule/border/stroke color
                                                           sc -- shadow color

  GRAPHICS ELEMENT          GRAPHICS ELEMENT COLOR TYPE:
  gr -- graphics element    bg -- background color
                            fg -- foreground color

  TYPE INDICATOR COLOR:         LANGUAGE TYPE:
  ty -- type indicator color    markdown
                                plain
                                latex
                                javascript
  ---

  PROPERTY NAMES:
  --theme-{ELEMENT TYPE}-{ELEMENT COLOR TYPE}
  --theme-{GRAPHICS ELEMENT TYPE}-{GRAPHICS ELEMENT COLOR TYPE}
  --theme-{TYPE INDICATOR COLOR}-{LANGUAGE TYPE}
*/
`;

// the first standard theme is the default theme and will be used if no other theme is specified
const standard_theme_names = [ theme_light, theme_dark ];  // array length must match array length of values in standard_themes_spec

export const default_theme_name = standard_theme_names[0];

export function get_standard_theme_names() {
    return [ ...standard_theme_names ];
}

const standard_themes_spec = {
    //                         === LIGHT ===                    === DARK ===

    "--theme-si-bg":         [ 'hsl(  0deg   0%  99% / 100%)',  '#333' ],
    "--theme-si-fg":         [ 'black',                         '#ccc' ],
    "--theme-si-ef":         [ 'red',                           'red' ],
    "--theme-si-df":         [ '#bbb',                          '#666' ],
    "--theme-si-hb":         [ '#0004',                         '#fff4' ],
    "--theme-si-rc":         [ '#ccc',                          '#4a4a4a' ],
    "--theme-si-sc":         [ 'grey',                          '#444' ],

    "--theme-ui-bg":         [ 'hsl(  0deg   0%  99% / 100%)',  '#111' ],
    "--theme-ui-fg":         [ 'black',                         '#ccc' ],
    "--theme-ui-ef":         [ 'red',                           'red' ],
    "--theme-ui-df":         [ '#bbb',                          '#666' ],
    "--theme-ui-hb":         [ '#0004',                         '#fff4' ],
    "--theme-ui-rc":         [ '#ccc',                          '#4a4a4a' ],
    "--theme-ui-sc":         [ 'grey',                          '#444' ],

    "--theme-ou-bg":         [ 'white',                         'black' ],
    "--theme-ou-fg":         [ 'black',                         '#eee' ],
    "--theme-ou-ef":         [ 'red',                           'red' ],
    "--theme-ou-df":         [ '#bbb',                          '#666' ],
    "--theme-ou-hb":         [ '#0004',                         '#fff4' ],
    "--theme-ou-rc":         [ '#ccc',                          '#4a4a4a' ],
    "--theme-ou-sc":         [ 'grey',                          '#444' ],

    "--theme-gr-fg":         [ 'black',                         'white'  ],
    "--theme-gr-bg":         [ 'transparent',                   'transparent' ],

    "--theme-ty-markdown":   [ 'hsl(205deg  85%  88% / 100%)',  'hsl(205deg  80%  20% / 100%)' ],
    "--theme-ty-plain":      [ 'lightgrey',                     'hsl(  0deg   0%  20% / 100%)' ],
    "--theme-ty-latex":      [ 'hsl(325deg  30%  85% / 100%)',  'hsl(325deg  30%  24% / 100%)' ],
    "--theme-ty-javascript": [ 'hsl(105deg  55%  85% / 100%)',  'hsl(135deg  45%  15% / 100%)' ],
};

const standard_theme_prop_names = Object.keys(standard_themes_spec);

export function get_standard_theme_prop_names() {
    return [ ...standard_theme_prop_names ];
}

const standard_themes: object[] = standard_theme_names
      .map((theme_name, theme_idx) => {
          return {
              name: theme_name,
              props: Object.fromEntries(
                  Object.entries(standard_themes_spec)
                      .map(([ prop_name, mode_values ]) => {
                          return [ prop_name, mode_values[theme_idx] ];
                      })
              ),
          };
      });

const default_standard_theme = standard_themes[0];


// === COPY/EQUIVALENCE ===

function copy_theme(theme: object): object {
    return JSON.parse(JSON.stringify(theme));
}

function copy_themes_settings(themes_settings: object[]): object[] {
    return themes_settings.map(theme => copy_theme(theme));
}

/** compare two theme specifications
 * @param {Object} theme1
 * @param {Object} theme2
 * @return {Boolean} result
 * Equivalence requires:
 * - both themes contain all standard_theme_prop_names
 * - both themes agree on values for standard_theme_prop_names
 */
function equivalent_themes(theme1: object, theme2: object): boolean {
    if (typeof theme1 !== 'object' || typeof theme2 !== 'object') {
        throw new Error('specified themes must be objects');
    }
    if (theme1 === theme2) {
        return true;
    } else {
        for (const prop of standard_theme_prop_names) {
            if (!(prop in (theme1 as any).props) || !(prop in (theme2 as any).props) || (theme1 as any).props[prop] !== (theme2 as any).props[prop]) {
                return false;
            }
        }
        return true;  // all standard_theme_prop_names present and matched
    }
}


// === TO/FROM STORAGE ===

// theme_settings, if given, is validated.
// theme_settings, if not given, defaults to [].
// Unmodified standard themes are filtered from what is stored.
async function put_themes_settings_to_storage(themes_settings?: null|object[]): Promise<void> {
    themes_settings ??= [];
    validate_themes_array(themes_settings);
    // filter out unmodified standard themes
    const filtered_themes_settings = themes_settings.filter(theme => {
        const corresponding_standard_theme = standard_themes.find(st => ((st as any).name === (theme as any).name));
        // true -> keep
        return !corresponding_standard_theme || !equivalent_themes(corresponding_standard_theme, theme);
    });
    return storage_db.put(db_key_themes, filtered_themes_settings);
}

// the returned theme_settings is not validated.
// the returned theme_settings will not contain any (unmodified) standard theme settings.
async function get_themes_settings_from_storage(): Promise<object[]> {
    return storage_db.get(db_key_themes)
        .then((themes_settings) => {
            if (!themes_settings) {
                throw new Error('themes_settings not found');
            }
            return themes_settings;
        });
}


// === THEME STYLE ELEMENT ===

export const themes_style_element_id = `themes-${generate_uuid()}`;

function get_themes_style_element(): null|HTMLStyleElement {
    const style_element = document.getElementById(themes_style_element_id);
    if (style_element && !(style_element instanceof HTMLStyleElement)) {
        throw new Error(`configuration error: themes_style_element_id="${themes_style_element_id}" does not refer to an HTMLStyleElement`);
    }
    return style_element;
}

function create_themes_style_element(): HTMLStyleElement {
    if (get_themes_style_element()) {
        throw new Error(`element with id ${themes_style_element_id} already exists`);
    }
    if (!document.head) {
        throw new Error('document.head missing');
    }
    return create_element({
        tag: 'style',
        parent: document.head,
        attrs: {
            id: themes_style_element_id,
        },
    }) as HTMLStyleElement;
}


// === VALIDATION AND INITIALIZATION ===

function validate_theme_props(theme_props: object): void {
    if ( typeof theme_props !== 'object' ||
         !Object.entries(theme_props).every(([ k, v ]) => {
             return ( typeof(k) === 'string' &&
                      !!k.match(theme_prop_name_validation_re) &&
                      typeof(v) === 'string' );
         })
       ) {
        throw new Error('theme_props must have valid CSS property names starting with --theme- and with string values');
    }
}

function validate_theme(theme: object): void {
    const { name, props } = (theme as any);
    if (name === theme_system) {
        throw new Error(`"${theme_system}" is a reserved theme name`);
    }
    if (typeof name !== 'string' || !name.match(theme_name_validation_re)) {
        throw new Error('invalid theme name');
    }
    validate_theme_props(props);
    for (const prop_name of standard_theme_prop_names) {
        if (!(prop_name in props)) {
            throw new Error('theme is missing expected properties');
        }
    }
}

function validate_themes_array(themes: object[]): void {
    if (!Array.isArray(themes)) {
        throw new Error('themes must be an array of valid themes');
    }
    const names = new Set();
    for (const theme of themes) {
        if (names.has((theme as any).name)) {
            throw new Error('themes must not contain entries with duplicated names');
        }
        names.add((theme as any).name);
        validate_theme(theme);
    }
}

function adjust_theme(theme: object): undefined|{ name: string, props: object } {
    const { name, props } = (theme as any);
    validate_theme_props(props);

    let adjustment_made = false;
    const adjusted_props = { ...props };
    for (const required_prop_name of standard_theme_prop_names) {
        if (!(required_prop_name in props)) {
            adjustment_made = true;
            const value = (name in standard_themes)
                  ? (standard_themes as any)[name][required_prop_name]
                  : (default_standard_theme as any)[required_prop_name];  // fall back to first theme if name not found
            adjusted_props[required_prop_name] = value ?? 'unset';
        }
    }
    // note that props that do no appear in standard_theme_prop_names are left intact

    return adjustment_made ? { name, props: adjusted_props } : undefined;
}

function adjust_themes_array(themes: object[]): undefined|object[] {
    if (!Array.isArray(themes) || themes.length <= 0) {
        throw new Error('themes must be an array of valid themes with at least one element');
    }
    let adjustment_made = false;
    const adjusted_themes = themes.map((theme) => {
        const adjusted_theme = adjust_theme(theme);
        if (!adjusted_theme) {
            return theme;
        } else {
            adjustment_made = true;
            return adjusted_theme;
        }
    });
    return adjustment_made ? adjusted_themes : undefined;
}

function create_theme_style_element_section(theme: object, default_mode: boolean = false): string {
    const { name, props } = (theme as any);
    return `\
:root${default_mode ? '' : `[${root_element_theme_attribute}="${name}"]`} {
${ Object.entries(props)
       .map(([ prop_name, prop_value ]) => {
           return `    ${prop_name}: ${prop_value};`;
       })
       .join('\n') }
}
`;
}

/** write the given themes into the themes_style_element.
 *  both inputs are validated
 * @param {Array} themes
 * @param {HTMLElement} themes_style_element
 */
async function write_themes_to_style_element(themes: object[], themes_style_element: HTMLElement): Promise<void> {
    validate_themes_array(themes);
    if (!(themes_style_element instanceof HTMLElement) || themes_style_element.tagName?.toLowerCase() !== 'style') {
        throw new Error('invalid themes_style_element');
    }
    const sections = [];
    sections.push(theme_property_name_documentation);
    sections.push(create_theme_style_element_section(themes[0], true));  // default/unspecfied theme
    for (const theme of themes) {
        sections.push(create_theme_style_element_section(theme));
    }
    themes_style_element.textContent = sections.join('\n');
}

/** initialize themes in db if necessary, writing theme styles to the themes_style_element,
 *  and return a value for _current_themes_settings
 * @return {Array} newly-established theme_settings
 */
async function initialize_themes(): Promise<object[]> {
    return get_themes_settings_from_storage()
        .catch((_) => {
            return put_themes_settings_to_storage(null)  // initialize empty
                .catch((error) => {
                    console.error(error);
                    throw new Error('unable to initialize themes storage');
                })
                .then(() => []);
        })
        .then((themes_settings_from_storage) => {
            // themes_settings_from_storage is now an array of themes from storage.
            // However, these themes do not include any unmodified standard themes.
            const themes_settings = [];  // accumulated below
            // accumulate standard themes, in order, into the beginning of themes_settings
            for (const standard_theme of standard_themes) {
                const theme_from_storage = themes_settings_from_storage.find(t => ((t as any).name === (standard_theme as any).name));
                const theme = theme_from_storage ?? standard_theme;
                themes_settings.push(theme);
            }
            // then append the remaining themes from storage
            for (const theme_from_storage of themes_settings_from_storage) {
                if (!standard_theme_names.includes((theme_from_storage as any).name)) {
                    themes_settings.push(theme_from_storage);
                }
            }
            const adjusted = adjust_themes_array(themes_settings);
            if (!adjusted) {
                validate_themes_array(themes_settings);
                return themes_settings;
            } else {
                return put_themes_settings_to_storage(adjusted)  // also validates
                    .catch((error) => {
                        console.error(error);
                        throw new Error('unable to rewrite adjusted themes');
                    })
                    .then(() => adjusted);
            }
        })
        .then((themes_settings) => {
            // themes_settings is now fully validated and synchronized with storage
            const themes_style_element = get_themes_style_element() ?? create_themes_style_element();
            return write_themes_to_style_element(themes_settings, themes_style_element)
                .catch((error) => {
                    console.error(error);
                    throw new Error('unable to write to style element');
                })
                .then(() => themes_settings);
        });
}


// === SYSTEM THEME SETTINGS INTERFACE ===

const dark_mode_media_query_list = globalThis.matchMedia("(prefers-color-scheme: dark)");

/** set the document attribute specified by root_element_theme_attribute
 *  according to the given state
 * @param {Boolean} dark_state
 */
function set_document_dark_state(dark_state: boolean): void {
    //!!! this will reset the user's theme setting if not dark or light (the default)
    if (dark_state) {
        root_element.setAttribute(root_element_theme_attribute, theme_dark);
    } else {
        root_element.removeAttribute(root_element_theme_attribute);  // default: light
    }
}

/** update the dark state for the document according to the current system-level
 *  "prefers" setting (light, dark), but with priority to the user's setting for
 *  this program (system, light, dark).
 */
function update_document_dark_state(): void {
    switch ((get_settings() as any).theme) {
        default:
        case theme_system: {
            set_document_dark_state(dark_mode_media_query_list.matches);
            break;
        }
        case theme_light: {
            set_document_dark_state(false);
            break;
        }
        case theme_dark: {
            set_document_dark_state(true);
            break;
        }
    }
}


// === EVENT INTERFACE ===

export const themes_settings_updated_events = new SerialDataSource<void>();


// === THEME SETTINGS GET/UPDATE INTERFACE ===

let _current_themes_settings = await initialize_themes();

export function get_themes_settings(): object[] {
    return copy_themes_settings(_current_themes_settings);
}

export async function update_themes_settings(new_themes_settings: object[]): Promise<void> {
    new_themes_settings = copy_themes_settings(new_themes_settings);
    await put_themes_settings_to_storage(new_themes_settings);  // also validates
    const themes_style_element = get_themes_style_element();
    if (!themes_style_element) {
        throw new Error('themes_style_element does not yet exist');
    }
    write_themes_to_style_element(new_themes_settings, themes_style_element);
    _current_themes_settings = new_themes_settings;
    themes_settings_updated_events.dispatch();
}

export async function reset_to_standard_themes_settings(): Promise<void> {
    return update_themes_settings(standard_themes);
}


// === INITIALIZATION ===

dark_mode_media_query_list.addEventListener('change', update_document_dark_state);
settings_updated_events.subscribe(update_document_dark_state);
update_document_dark_state();  // initialize now from current settings/themes_settings

(globalThis as any).reset_to_standard_themes_settings = reset_to_standard_themes_settings;//!!!
