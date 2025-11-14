import {
    create_element,
} from './dom-tools'


// This file contains the support code for supporting JSX markup in .tsx files.
// The name of the exported function, "_jsx_create_element", is specified in
// tsconfig.json under the compilerOptions.jsxFactory key.

// declare JSX.IntrinsicElements which is used to type-check JSX output
declare global {
    // thanks to the Connor Low answer at https://stackoverflow.com/questions/41557309/typescript-jsx-without-react
    namespace JSX {
        // The return type of our JSX Factory: this could be anything
        type Element = HTMLElement;

        // IntrinsicElementMap grabs all the standard HTML tags in the TS DOM lib.
        interface IntrinsicElements extends IntrinsicElementMap { }

        // The following are custom types, not part of TS's known JSX namespace:
        type IntrinsicElementMap = {
            [K in keyof HTMLElementTagNameMap]: {
                [k: string]: any
            }
        }

        interface Component {
            (properties?: { [key: string]: any }, children?: Node[]): Node
        }
    }
}

export function _jsx_create_element(type: string, props: { [key: string]: string }, ...children: (string|Node)[]): Node {
    const node = create_element({ tag: type, attrs: { ...props } });
    children.forEach(child => {
        // note: the type signatre for children is ignored when it is actually
        // used, so do a run-time check.
        if (typeof child === 'string') {
            node.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            node.appendChild(child);
        } else {
            console.error('child must be a string or an instance of Node', { child });
            throw new TypeError('child must be a string or an instance of Node');
        }
    });
    return node;
}
