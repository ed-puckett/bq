import {
    OpenPromise,
} from 'lib/sys/open-promise';


export async function fs_perform_save(contents: ReadableStream, document_url: URL|Location) {
    // (return an explicit promise that we can resolve from within an event callback)
    return new Promise(async (resolve, reject) => {
        // get contents as a string
        const contents_chunks = [];
        for (const reader = contents.getReader(); ; ) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            contents_chunks.push(value);
        }
        const contents_string = contents_chunks.join('');
        // set up an <a> element to implement the download
        const a_el = document.createElement('a') as HTMLAnchorElement;
        a_el.download = document_url.pathname.split('/').slice(-1)[0];  // just the last component of the pathname
        const blob = URL.createObjectURL(new Blob([ contents_string ], { type: 'text/html'}));
        a_el.href = blob;
        const completion_callback = () => {
            window.removeEventListener('focus', completion_callback);
            URL.revokeObjectURL(blob);
            a_el.href = '';
            resolve(true);
        };
        window.addEventListener('focus', completion_callback);  // this will happen when completed or when cancelled
        // simulate a click on the <a> element and initiate the download
        a_el.click();
    });
}
