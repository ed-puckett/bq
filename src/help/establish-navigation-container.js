export function establish_navigation_container(ocx, options=null) {
    const {
        selector = '.help-content',
        heading,
        no_scroll,
    } = (options ?? {});

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

    ocx.CLASS.create_element({
        parent: document.head,
        tag: 'style',
        innerText: `
#${enclosing_output_element.id} {
    padding: 0;
    margin: 0;
}
.help-container {
    display: flex;
    flex-direction: row;
}
.help-sidebar,
.help-content {
    overflow: auto;
    max-height: calc(100dvh - var(--header-dynamic-height));
    padding: 0 1em;
    min-width: fit-content;
}
.help-sidebar {
    flex-grow: 0;

    & a {
        display: inline-block;
        margin: 0.25em 0;
    }
}
.help-content {
    flex-grow: 1;
}
`,
    });

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
        children: [{
            attrs: {
                class: 'help-sidebar',
            },
            children: sidebar_children,
        }],
    });
    container_element.appendChild(content_element);

    if (!no_scroll) {
        container_element.scrollIntoView();
    }

    return container_element;
}
