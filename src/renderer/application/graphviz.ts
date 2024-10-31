const current_script_url = import.meta.url;  // save for later

import {
    load_d3,
} from './d3';

import {
    load_script,
} from 'lib/ui/dom-tools';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';


let loaded = false;
async function load_modules() {
    const d3 = await load_d3();
    if (!loaded) {
        const server_url = assets_server_url(current_script_url);
        await load_script(document.head, new URL('../../../dist/graphviz.umd.js',    server_url));
        await load_script(document.head, new URL('../../../dist/d3-graphviz.min.js', server_url));
        loaded = true;
    }
    return d3;
}

export async function render(element_selector: string, dot: string, options: any) {
    const d3 = await load_modules();
    const {
        transition = "main",
        ease       = d3.easeLinear,
        delay      = 0,
        duration   = 0,
        logEvents  = true,
    } = (options ?? {});
    return new Promise((resolve, reject) => {
        try {
            function reject_with_string(...args: string[]) {
                reject(new Error(args[0]));
            }
            const graphviz = d3.select(element_selector).graphviz({
                useWorker:       false,
                useSharedWorker: false,
            });
            graphviz
                .transition(function () {
                    return d3.transition(transition)
                        .ease(ease)
                        .delay(delay)
                        .duration(duration);
                })
                .logEvents(logEvents)
                .onerror(reject_with_string)
                .on("initEnd", function () {
                    graphviz
                        .renderDot(dot)
                        .onerror(reject_with_string)
                        .on("end", resolve);
                });
        } catch (error) {
            reject(error);
        }
    });
}
