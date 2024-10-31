// subordinate types for circularly-dependent Renderer and OutputContext types

export type TextBasedRendererOptionsType = {
    style?:        object,   // css style to be applied to output element
    inline?:       boolean,  // render inline vs block?
    global_state?: object,   // global_state for evaluation; default: ocx.bq.global_state using ocx passed to render()
};
