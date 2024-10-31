import {
    ApplicationBasedRenderer,
} from 'src/renderer/renderer';

import {
    GraphvizRendererValueType,
    GraphvizRendererOptionsType,
} from './types';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    render as graphviz_render,
} from './graphviz';


export class GraphvizRenderer extends ApplicationBasedRenderer<GraphvizRendererValueType, GraphvizRendererOptionsType> {
    static get type (){ return 'graphviz'; }

    async _render(ocx: OutputContextLike, graphviz_config: GraphvizRendererValueType, options?: GraphvizRendererOptionsType): Promise<Element> {
        const style = options?.style;

        const element = ocx.create_child({
            attrs: {
                [OutputContextLike.attribute__data_source_media_type]: this.media_type,
            },
            style,
            set_id: true,  // required for selector below
        });
        const element_selector = `#${element.id}`;

        const dot_stmts = [];
        if (graphviz_config?.node_config) {
            dot_stmts.push(`node ${graphviz_config.node_config}`);
        }
        for (const node_spec of (graphviz_config?.nodes ?? [])) {
            if (typeof node_spec === 'string') {
                const name = node_spec;
                dot_stmts.push(name);
            } else {
                const [ name, node_options ] = (node_spec as any);
                dot_stmts.push(`${name} [${node_options}]`);
            }
        }
        for (const [ from, to, edge_options ] of ((graphviz_config as any)?.edges ?? [])) {
            dot_stmts.push(`${from}->${to}${edge_options ? `[${edge_options}]` : ''}`);
        }
        const dot = `digraph { ${dot_stmts.join(';')} }`;

        // create and run the renderer
        await graphviz_render(element_selector, dot, {});

        return element;
    }
}
