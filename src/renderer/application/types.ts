// subordinate types for circularly-dependent Renderer and OutputContext types

export type ErrorRendererValueType = unknown;

export type ErrorRendererOptionsType = {
    style?:       object,
    abbreviated?: boolean,
};


export type ImageDataRendererValueType = {
    x?:         number,  // default value: 0
    y?:         number,  // default value: 0
    image_data: ImageData,
};

export type ImageDataRendererOptionsType = {
    style?: object,
};


export type GraphvizRendererValueType = {
     node_config?: string,
     nodes?:       object[],  // (string | [ string, string ])[],  // name and node_options
     edges?:       object[],  // [ string, string, { label?: string, ... }? ][],  // from and to
};

export type GraphvizRendererOptionsType = {
    style?: object,
};


export type PlotlyRendererValueType = {
    data?:   object,
    layout?: object,
    config?: object,
    frames?: Array<unknown>,
};

export type PlotlyRendererOptionsType = {
    style?: object,
};


export type CanvasImageRendererValueType = {
    /*async*/ (canvas: HTMLCanvasElement): Promise<void>,
};

export type CanvasImageRendererOptionsType = {
    style?: object,
};
