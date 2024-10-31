export function run(ocx) {
    const {
        video,
        canvas1,
        canvas2,
        angle,
        alpha0,
        alpha1,
        op,
        frame_delay,
    } = ocx.create_child_mapping({
        children: [{
            _key: 'video',
            tag:  'video',
        }, {
            _key: 'canvas1',
            tag:  'canvas',
        }, {
            _key: 'canvas2',
            tag:  'canvas',
        }, {
            style: {
                display: 'grid',
                'grid-template-columns': 'auto auto',
                'justify-content': 'start',
                gap: '0.1em',
            },
            children: [{
                tag: 'label',
                children: [ 'angle' ],
                attrs: { for: 'angle' },
            }, {
                _key: 'angle',
                tag:  'input',
                attrs: {
                    id:    'angle',
                    type:  'number',
                    value: Math.PI/3,
                    min:   0,
                    max:   2*Math.PI - 1e-14,
                    step:  Math.PI/24,
                },
            }, {
                tag: 'label',
                children: [ 'scale' ],
                attrs: { for: 'scale' },
            }, {
                _key: 'scale',
                tag:  'input',
                attrs: {
                    id:    'scale',
                    type:  'number',
                    value: 1,
                    min:   0.5,
                    max:   2,
                    step:  0.1,
                },
            }, {
                tag: 'label',
                children: [ 'alpha0' ],
                attrs: { for: 'alpha0' },
            }, {
                _key: 'alpha0',
                tag:  'input',
                attrs: {
                    id:    'alpha0',
                    type:  'number',
                    value: 1,
                    min:   0,
                    max:   1,
                    step:  0.1,
                },
            }, {
                tag: 'label',
                children: [ 'alpha1' ],
                attrs: { for: 'alpha1' },
            }, {
                _key: 'alpha1',
                tag:  'input',
                attrs: {
                    id:    'alpha1',
                    type:  'number',
                    value: 0.3,
                    min:   0,
                    max:   1,
                    step:  0.1,
                },
            }, {
                tag: 'label',
                children: [ 'op' ],
                attrs: { for: 'op' },
            }, {
                _key: 'op',
                tag:  'select',
                attrs: {
                    id: 'op',
                },
                children: [  // put one element in an array to mark it as the default selected item
                    'source-over', 'source-in', 'source-out', 'source-atop',
                    'destination-over', 'destination-in', 'destination-out', 'destination-atop',
                    'lighter', 'copy', 'xor', 'multiply', 'screen', 'overlay',
                    'darken', 'lighten', 'color-dodge', 'color-burn', ['hard-light'], 'soft-light',
                    'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
                ].map(op => {
                    const selected = (typeof op !== 'string');
                    if (selected) {
                        op = op[0];
                    }
                    return {
                        tag: 'option',
                        attrs: {
                            value: op,
                            ...(selected ? { selected: '' } : {}),
                        },
                        children: [ op ],
                    };
                }),
            }, {
                tag: 'label',
                children: [ 'frame delay (ms)' ],
                attrs: { for: 'frame_delay' },
            }, {
                _key: 'frame_delay',
                tag:  'input',
                attrs: {
                    id:    'frame_delay',
                    type:  'number',
                    value: 100,
                    min:   10,
                    max:   2000,
                    step:  10,
                },
            }],
        }],
    });

    const canvases = [ canvas2, canvas1 ];  // [ selected, hidden ]
    function switch_canvases() {
        canvases.reverse();
        canvases[0].style.display = 'initial';
        canvases[1].style.display = 'none';
    }
    switch_canvases();  // set inital display properties on canvas1 and canvas2

    const k1 = new Uint8ClampedArray([
        1, 1, 1,
        1, 0, 1,
        1, 1, 1,
    ]);

    const k2 = new Uint8ClampedArray([
        1, 1, 1,
        1, 0, 1,
        1, 1, 1,
    ]);

    const kw = 3;
    const kh = 3;

    const multiplier = 1/16;

    let width, height;

    function render_to_hidden_canvas() {
        const [ selected_canvas, output_canvas ] = canvases;

        const context = output_canvas.getContext('2d');

        context.globalAlpha = +alpha0.value;
        context.globalCompositeOperation = op.value;
        context.resetTransform();
        context.drawImage(video, 0, 0, width, height);

        const image = new OffscreenCanvas(width, height);
        {
            const image_data = selected_canvas.getContext('2d').getImageData(0, 0, width, height);
            image.getContext('2d').putImageData(image_data, 0, 0);
        }

        context.globalAlpha = +alpha1.value;
        context.globalCompositeOperation = 'source-over';
        context.resetTransform();
        context.translate(width/2, height/2);
        context.scale(+scale.value, +scale.value);
        context.rotate(+angle.value);
        context.translate(-width/2, -height/2);
        context.drawImage(image, 0, 0, width, height);
    }

    navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((stream) => {
            video.srcObject = stream;
            video.play();
        })
        .catch((error) => {
            console.error(`An error occurred: ${error}`);
        });

    video.addEventListener('canplay', (event) => {
        width  = video.videoWidth;
        height = video.videoHeight;
        const vw = width  / 4;
        const vh = height / 4;
        canvas1.width  = width;
        canvas1.height = height;
        canvas2.width  = video.videoWidth;
        canvas2.height = video.videoHeight;
        const w_style = `${width}px`;
        const h_style = `${height}px`;
        const vw_style = `${vw}px`
        const vh_style = `${vw}px`
        video.style.width  = vw_style;
        video.style.height = vh_style;
        canvas1.style.width  = w_style;
        canvas1.style.height = h_style;
        canvas2.style.width  = w_style;
        canvas2.style.height = h_style;

        function schedule_render() {
            setTimeout(() => {
                render_to_hidden_canvas();
                switch_canvases();
                schedule_render();
            }, +frame_delay.value);
        }
        schedule_render();
    }, {
        once: true,
    });
}

function convolve_canvas(out, c1, c2, mult, kw, kh, k1_data, k2_data) {
    if (!(out instanceof CanvasRenderingContext2D) || !(c1 instanceof CanvasRenderingContext2D) || !(c2 instanceof CanvasRenderingContext2D)) {
        throw new Error('out, c1 and c2 must all be instances of CanvasRenderingContext2D');
    }
    const dw = out.width;
    const dh = out.height;
    if (dw !== c1.width || dh !== c1.height || dw !== c2.width || dh !== c2.height) {
        throw new Error('out, c1 and c2 must all have the same widths and heights');
    }
    const c1_data  = c1.getImageData(0, 0, dw, dh).data;
    const c2_data  = c2.getImageData(0, 0, dw, dh).data;
    const out_data = out.getImageData(0, 0, dw, dh).data;
    convolve_data(dw, dh, out_data, c1_data, c2_data, mult, kw, kh, k1_data, k2_data);
}

function convolve_data(dw, dh, out_data, data1, data2, kw, kh, k1_data, k2_data, multiplier=1) {
    if ( !(out_data instanceof Uint8ClampedArray) || !(data1 instanceof Uint8ClampedArray) || !(data2 instanceof Uint8ClampedArray) ||
         !(k1_data instanceof Uint8ClampedArray) || !(k2_data instanceof Uint8ClampedArray) ) {
        throw new Error('out_data, data1, data2, k1_data and k2_data must all be instances of Uint8ClampedArray');
    }
    if (!Number.isInteger(dw) || dw <= 0 || !Number.isInteger(dh) || dh <= 0) {
        throw new Error('dw and dh must be positive integers');
    }
    if (!Number.isInteger(kw) || kw <= 0 || (kw&1 === 0) || !Number.isInteger(kh) || kh <= 0 || (kh&1 === 0)) {
        throw new Error('dw and dh must be positive odd integers');
    }
    if (typeof multiplier !== 'number') {
        throw new Error('multiplier must be a number');
    }
    const kwm = kw/2;
    const khm = kh/2;
    for (let di = 0; di < dw; di++) {
        for (let dj = 0; dj < dh; dj++) {
            let acc = 0;
            for (let ki = 0; ki < kw; ki++) {
                for (let kj = 0; kj < kh; kj++) {
                    const d_idx = dw*(dj+kj-khm) + (di+ki-kwm);
                    const k_idx = kw*kj + ki;
                    acc += (data1[d_idx] * k1_data[k_idx]) + (data2[d_idx] * k2_data[k_idx]);
                }
            }
            out[d_idx] = multiplier*acc;
        }
    }
}
