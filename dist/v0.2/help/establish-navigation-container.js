export function establish_navigation_container(ocx, options=null) {
    const {
        selector = '.bq-help-content',
        heading,
        no_scroll,
    } = (options ?? {});

    const content_element = ocx.element.closest('output[class="bq-cell-output"]')?.querySelector(selector);
    if (!content_element) {
        throw new Error('content_element not found');
    }

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
            class: 'bq-help-container',
        },
        children: [{
            attrs: {
                class: 'bq-help-sidebar',
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
