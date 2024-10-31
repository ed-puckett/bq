import {
    ApplicationBasedRenderer,
} from 'src/renderer/renderer';

import {
    PlotlyRendererValueType,
    PlotlyRendererOptionsType,
} from './types';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    load_Plotly,
} from './plotly';


export class PlotlyRenderer extends ApplicationBasedRenderer<PlotlyRendererValueType, PlotlyRendererOptionsType> {
    static get type (){ return 'plotly'; }

    async _render(ocx: OutputContextLike, plotly_config: PlotlyRendererValueType, options?: PlotlyRendererOptionsType): Promise<Element> {
        if (typeof plotly_config !== 'object') {
            throw new Error('plotly_config must be an object');
        }

        const style = options?.style;

        let data:   object;
        let layout: object;
        let config: object;
        let frames: Array<unknown>;
        if ('data' in plotly_config && Array.isArray(plotly_config.data)) {
            ({
                data,
                layout = {},
                config = {},
                frames = [],
            } = plotly_config);
        } else {
            data = plotly_config;
            layout = {};
            config = {};
            frames = [];
        }
        layout ??= {};
        (layout as any).plot_bgcolor  ??= 'rgba(0, 0, 0, 0)';
        (layout as any).paper_bgcolor ??= 'rgba(0, 0, 0, 0)';

        (config as any).displayModeBar = false;  // remove icons/links from top-right of plot

        const parent = ocx.create_child({
            attrs: {
                [OutputContextLike.attribute__data_source_media_type]: this.media_type,
            },
        });
        const output_element = ocx.CLASS.create_element({
            parent,
            style,
        });
        const Plotly = await load_Plotly();
        await Plotly.newPlot(output_element, { data, layout, config, frames });  // render to the output_element

        return parent;
    }
}
