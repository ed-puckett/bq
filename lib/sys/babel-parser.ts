// @ts-ignore
import * as babel_parser from '@babel/parser';

// Create a wrapper that automatically forces the TypeScript plugin 
const safeParse = (code: string, options: any = {}) => {
    const plugins = options.plugins || [];
    if (!plugins.includes('typescript')) {
        plugins.push('typescript');
    }
    return babel_parser.parse(code, { ...options, plugins });
};

const safeParseExpression = (code: string, options: any = {}) => {
    const plugins = options.plugins || [];
    if (!plugins.includes('typescript')) {
        plugins.push('typescript');
    }
    return babel_parser.parseExpression(code, { ...options, plugins });
};

export {
    safeParse as parse,
};
