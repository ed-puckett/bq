export default function establish_navigation_container(ocx, options=null) {
    const {
        selector = '*',
        heading,
        nav_trail,
        nav_trail_heading,
        no_scroll,
    } = (options ?? {});

    if (selector !== null && ![ 'undefined', 'string' ].includes(typeof selector)) {
        throw new TypeError('selector must be undefined, null, or a string');
    }
    if (heading !== null && ![ 'undefined', 'string' ].includes(typeof heading)) {
        throw new TypeError('heading must be undefined, null, or a string');
    }
    if ( nav_trail !== null && typeof nav_trail !== 'undefined' &&
         !( Array.isArray(nav_trail) && nav_trail.every(pair_item => Array.isArray(pair_item) && pair_item.length === 2 && pair_item.every(item => typeof item === 'string')) ) ) {
        throw new TypeError('nav_trail must be undefined, null, or an array of arrays of pairs of strings');
    }
    if (nav_trail_heading !== null && ![ 'undefined', 'string' ].includes(typeof nav_trail_heading)) {
        throw new TypeError('nav_trail_heading must be undefined, null, or a string');
    }

    const enclosing_output_element = ocx.element.closest('output[class~="bq-cell-output"]');
    if (!enclosing_output_element) {
        throw new Error('unexpected: no enclosing output element found');
    }
    if (!enclosing_output_element.id) {
        enclosing_output_element.id = `enclosing-output-element-${Date.now()}`;
    }

    const content_element = enclosing_output_element.querySelector(selector);
    if (!content_element) {
        throw new TypeError(`content_element not found for selector: ${selector}`);
    }

    // hide the content until it has been reprocessed
    const parent_ocx = ocx.parent;
    if (!parent_ocx) {
        throw new TypeError('ocx has no parent');
    }
    parent_ocx.element.classList.add('bq-hidden-block');

    // set up the deferred show (waiting for the rest of the markdown to be rendered)
    ocx.keepalive = true;
    parent_ocx.render_completions.subscribe(
        () => {
            parent_ocx.element.classList.remove('bq-hidden-block');
        },
        {
            abort_signal: parent_ocx.abort_signal,
            once: true,
        },
    );

    // continue setting up reprocessed content
    const nav_trail_grid_template_areas_css = nav_trail
          ? `grid-template-areas:
        "help-nav-trail help-nav-trail"
        "help-sidebar   help-content";
`
          : `grid-template-areas:
        "help-sidebar help-content";
`;

    // create the style element with the css defined above
    ocx.CLASS.create_element({
        parent: document.head,
        tag: 'style',
        innerText: `
#${enclosing_output_element.id} {
    padding: 0;
    margin: 0;
}
body:has(.help-container) {
    align-content: center;
}
.help-container {
    font-family: sans-serif;
    max-width: 72em;
    display: grid;
    ${nav_trail_grid_template_areas_css}
    --help-nav-trail-element-height: 2em;
    --help-nav-trail-element-padding: 0.5em;
    --help-nav-trail-element-border-width: 1px;
    --help-nav-trail-element-dynamic-height: ${!nav_trail ? '0em' : 'calc(var(--help-nav-trail-element-height) + calc(2 * calc(var(--help-nav-trail-element-padding) + var(--help-nav-trail-element-border-width))))'};
    grid-template-columns: [ nav-trail-start sidebar-start ] auto [ sidebar-end content-start ] 1fr [ content-end nav-trail-end ];
}
.help-nav-trail {
    height: var(--help-nav-trail-element-height);
    padding: var(--help-nav-trail-element-padding);
    grid-area: help-nav-trail;
    grid-column: nav-trail-start / nav-trail-end;
    align-content: center;
    border: var(--help-nav-trail-element-border-width) solid transparent;
    border-bottom-color: var(--theme-ui-rc);
}
.help-nav-trail-heading {
    display: inline-block;
    padding: 0 0.5em;
}
.help-nav-trail-item {
    display: inline-block;
    padding: 0 0.5em;
    border: 1px solid var(--theme-ui-rc);
}
.help-sidebar,
.help-content {
    overflow: auto;
    max-height: calc(100dvh - calc(var(--header-dynamic-height) + var(--help-nav-trail-element-dynamic-height)));
    padding: 0 1.5em;
    min-width: fit-content;
}
.help-sidebar {
    grid-area: help-sidebar;
    grid-column: sidebar-start / sidebar-end;

    & .help-sidebar-heading {
        margin-block-start: 0.67em;
        margin-block-end: 0.67em;
        font-size: 2em;
        font-weight: bold;
    }

    & a {
        display: block;
        margin: 0.25em 0;
    }

    & .help-sidebar-link-heading {
        margin-block-start: 0.67em;
        margin-block-end: 0.67em;
        font-size: 1.5em;
        font-weight: bold;
    }

    & li {
        list-style: none;
    }
}
.help-content {
    grid-area: help-content;
    grid-column: content-start / content-end;
}
`,
    });

    const nav_trail_child = !nav_trail ? undefined : (
        {
            attrs: {
                class: 'help-nav-trail',
            },
            children: [
                {
                    tag: 'span',
                    attrs: {
                        class: 'help-nav-trail-heading',
                    },
                    innerText: (nav_trail_heading ?? ''),
                },
                ...nav_trail
                    .map(([ label, uri ]) => {
                        return {
                            tag: 'a',
                            attrs: {
                                class: 'help-nav-trail-item',
                                href: uri,
                            },
                            innerText: label,
                        };
                    }),
            ],
        }
    );

    const sidebar_children = [];
    if (heading) {
        sidebar_children.push({
            attrs: {
                class: 'help-sidebar-heading',
            },
            innerText: heading,
        });
    }
    const nav_heading_id_prefix = 'nav-heading-';
    const nav_link_id_prefix    = 'nav-';
    let nav_links_container = null;
    content_element
        .querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id], h7[id], h8[id], h9[id]')
        .forEach(el => {
            if (el.id.startsWith(nav_heading_id_prefix)) {
                sidebar_children.push({
                    attrs: {
                        class: 'help-sidebar-link-heading',
                    },
                    innerText: el.innerText,
                });
                nav_links_container = [];
                sidebar_children.push({
                    tag: 'ul',
                    children: nav_links_container,
                });
            } else if (el.id.startsWith(nav_link_id_prefix)) {
                const a_def = {
                    tag: 'a',
                    attrs: {
                        href: `#${el.id}`,
                    },
                    innerText: el.innerText,
                };
                if (nav_links_container) {
                    nav_links_container.push({
                        tag: 'li',
                        children: [ 
                            { ...a_def },
                       ],
                    });
                } else {
                    sidebar_children.push(a_def);
                }
            }
        });

    // create the new element structure that will hold content_element
    const {
        container_element,
        content_container_element,
    } = ocx.CLASS.create_element_mapping({
        _key: 'container_element',
        parent: enclosing_output_element,
        attrs: {
            class: 'help-container',
        },
        children: [
            ...(nav_trail_child ? [ nav_trail_child ] : []),
            {
                attrs: {
                    class: 'help-sidebar',
                },
                children: sidebar_children,
            },
            {
                _key: 'content_container_element',
                attrs: {
                    class: 'help-content',
                }
            },
        ],
    });
    // move content_element into place
    content_container_element.appendChild(content_element);

    if (!no_scroll) {
        container_element.scrollIntoView();
    }

    return container_element;
}
