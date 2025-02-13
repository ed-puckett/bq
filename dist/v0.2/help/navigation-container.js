export function create_navigation_container(ocx, content_element) {
    const container_element = ocx.CLASS.create_element({
        before: content_element,
        attrs: {
            class: 'bq-help-container',
        },
        children: [{
            attrs: {
                class: 'bq-help-sidebar',
            },
            children: Array.from('abcdefg').flatMap(char => [ char, { tag: 'br' } ]),
        }],
    });
    container_element.appendChild(content_element);
    return container_element;
}
