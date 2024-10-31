// === RE-EXPORTS ===

export {
    RendererFactory,
    TextBasedRenderer,
    ApplicationBasedRenderer,
} from './renderer';

export { TextRenderer        } from './text/text-renderer';
export { MarkdownRenderer    } from './text/markdown-renderer';
export { TeXRenderer         } from './text/tex-renderer';
export { JavaScriptRenderer  } from './text/javascript-renderer/_';

export { ErrorRenderer       } from './application/error-renderer';
export { ImageDataRenderer   } from './application/image-data-renderer';
export { GraphvizRenderer    } from './application/graphviz-renderer';
export { PlotlyRenderer      } from './application/plotly-renderer';
export { CanvasImageRenderer } from './application/canvas-image-renderer';

export {
    TextBasedRendererOptionsType,
} from './text/types';

export {
    ErrorRendererValueType,
    ErrorRendererOptionsType,

    ImageDataRendererValueType,
    ImageDataRendererOptionsType,

    GraphvizRendererValueType,
    GraphvizRendererOptionsType,

    PlotlyRendererValueType,
    PlotlyRendererOptionsType,

    CanvasImageRendererValueType,
    CanvasImageRendererOptionsType,
} from './application/types';


export {
    _initial_text_renderer_factories,  // for initialization only
} from './factories';
