// === VALIDATION ===

// lib/sys/assets_server_url will fail if the following script is not
// found, but unfortunately it fails silently when being employed to
// load other statically assets.  Fail now instead of later....
const _server_reference_url = document.querySelector('head script')?.src;
if (typeof _server_reference_url !== 'string' || _server_reference_url === '') {
    show_bootstrap_failed();
}

function show_bootstrap_failed(error) {
    error ??= new Error('bootstrap failed');

    // The main HTML document may still be loading (this script
    // should not be async or defer so that it can be effective
    // in inhibiting the initial display).
    function display_error() {
        if (!document.body) {
            document.documentElement.appendChild(document.createElement('body'));
            // document.body is now set
        }
        document.body.innerText = error.stack;
        globalThis._uninhibit_document_display?.();
    }

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        display_error();
    } else {
        window.addEventListener('load', (load_event) => {
            display_error();
        }, {
            once: true,
        });
    }

    throw error;  // attempt stop further inline execution of this script
}


// === MAIN BOOTSTRAP CODE ===

// This bootstrap script disables display of the document, then loads
// the init.js script to load everything else.  Then, the last thing
// the init.js script does is to remove the display-hiding style from
// document.documentElement by calling globalThis._uninhibit_document_display().
document.documentElement.style='display:none';
globalThis._uninhibit_document_display = function _uninhibit_document_display() {
    // This style attribute was added by bq-bootstrap.js and is set to
    // "display: none", thereby blanking the display while the document is
    // restructured.  Remove the "display" style property now to enable display.
    document.documentElement.style.display = '';
    globalThis._uninhibit_document_display = undefined;  // prevent further use
    delete globalThis._uninhibit_document_display;  // really prevent!!
}

// finally, import the rest of the application
// the rest of the application is taken relative to the bootstrap_script (and not necessarily this document location)
const bootstrap_script = document.querySelector('head script');
const init_url = new URL('../dist/init.js', bootstrap_script?.src);
import(init_url).catch(show_bootstrap_failed);
