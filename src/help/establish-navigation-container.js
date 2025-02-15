export default function establish_navigation_container(ocx, options=null) {
    const {
        selector = '.help-content',
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

    const enclosing_output_element = ocx.element.closest('output[class="bq-cell-output"]');
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

    const nav_trail_grid_template_areas_css = nav_trail
          ? `grid-template-areas:
        "help-nav-trail help-nav-trail"
        "help-sidebar   help-content";
`
          : `grid-template-areas:
        "help-sidebar help-content";
`;

    ocx.CLASS.create_element({
        parent: document.head,
        tag: 'style',
        innerText: `
#${enclosing_output_element.id} {
    padding: 0;
    margin: 0;
}
.help-container {
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

    & a {
        display: inline-block;
        margin: 0.25em 0;
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
            tag: 'h1',
            innerText: heading,
        });
    }
    content_element
        .querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id], h7[id], h8[id], h9[id]')
        .forEach(el => {
            const match = el.id.match(/^nav-/);
            if (match) {
                sidebar_children.push({
                    tag: 'a',
                    attrs: {
                        href: `#${el.id}`,
                    },
                    innerText: el.innerText,
                });
                sidebar_children.push({
                    tag: 'br',
                });
            }
        });

    const container_element = ocx.CLASS.create_element({
        before: content_element,
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
        ],
    });
    // move content_element into place
    container_element.appendChild(content_element);

    if (!no_scroll) {
        container_element.scrollIntoView();
    }

    return container_element;
}
