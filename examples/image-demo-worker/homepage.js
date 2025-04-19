// deno-lint-ignore-file no-unused-vars

const RESIZE_FRACTIONS = [ 0.25, 0.50, 1, 1.25, 1.5];
let _resizeFraction = 1;
let _transform;
let _output;
let _output2;
let _imgOrigin;

function selectImage(target) {
    const imgs = document.getElementById('imageSelector').getElementsByTagName('img');
    const selected = target && target.tagName === 'IMG' ? target : imgs[0];
    let changed = false;
    for (const img of imgs) {
        const wasSelected = img.classList.contains('selected-image');
        if (img === selected) {
            img.classList.add('selected-image');
            if (!wasSelected) changed = true;
        } else {
            img.classList.remove('selected-image');
        }
    }
    if (changed) {
        apply();
    }
}

function updateResizeLabel(input) {
    const fraction = RESIZE_FRACTIONS[input.value];
    const fractionText = fraction === 1 ? 'off' : `${fraction}x`;
    document.getElementById('resize_value').textContent = `resize (${fractionText})`;
}

function onResizeInput(input) {
    updateResizeLabel(input);
}

function onResizeChange(input) {
    updateResizeLabel(input);
    const fraction = RESIZE_FRACTIONS[input.value];
    if (fraction === _resizeFraction) return;
    _resizeFraction = fraction;
    apply();
}

function updateTransformParamLabel(input) {
    const valueElement = document.getElementById(`${input.id}_value`);
    let value = input.value;
    if (input.min === '0' && input.max === '1') {
        value = (parseFloat(value) * 100).toFixed(0) + '%';
    }
    if (input.dataset.kind === 'enum' || input.dataset.kind === 'channel') {
        const values = input.dataset.values.split(',');
        value = values[parseInt(value)];
    }
    valueElement.textContent = `${value}`;
}

function onTransformParamChange(input) {
    console.log(`onTransformParamChange ${input.id} ${input.value}`);
    updateTransformParamLabel(input);
    updateTransform();
}

function onTransformParamInput(input) {
    console.log(`onTransformParamInput ${input.id} ${input.value}`);
    updateTransformParamLabel(input);
}

function updateParamVisibility(input) {
    const transform = input?.id;
    for (const element of document.getElementById('transforms').querySelectorAll('[data-transform]')) {
        const selected = element.dataset.transform === transform;
        element.style.visibility = selected ? 'visible' : 'hidden';
        if (element.tagName === 'INPUT' && (element.type === 'range' || element.type === 'color')) {
            updateTransformParamLabel(element);
        }
    }
}

function computeTransform(radio, transforms) {
    let transform = radio.id;
    if (radio.id === '(no transform)') return undefined;
    const inputs = transforms.querySelectorAll(`input[data-transform=${transform}]`);
    const packedParams = [...inputs].map(input => {
        const name = input.id.substring(transform.length + 1);
        let value = input.value;
        let kind = input.dataset.kind;
        if (kind === 'enum') {
            const values = input.dataset.values.split(',');
            value = values[parseInt(value)];
            kind = 'string';
        }
        return `${value}:${kind}`;
    });
    transform += `(${packedParams.join(',')})`;
    return transform;
}

function updateTransform() {
    const transforms = document.getElementById('transforms');
    const radio = transforms.querySelector('input[type=radio]:checked');
    const transform = computeTransform(radio, transforms);
    console.log(transform);
    if (transform !== _transform) {
        _transform = transform;
        apply();
    }
}

function onTransformChange(input) {
    console.log(`onTransformChange ${input.id} ${input.checked}`);
    updateParamVisibility(input);
    updateTransform();
}

function apply() {
    const outputImg = document.getElementById('output');
    const outputLink = document.getElementById('output-link');
    outputImg.src = '';
    outputLink.href='#';

    const img = document.querySelectorAll('.selected-image')[0];
    const imgSrc = img.src;
    const unsplashLink = document.getElementById('unsplash-link');
    unsplashLink.href = `https://unsplash.com/photos/${img.dataset.unsplashId}?utm_source=${img.dataset.unsplashAppName}&utm_medium=referral`;
    unsplashLink.textContent = img.dataset.unsplashUserName;

    const origin = _imgOrigin || new URL(document.location.href).origin;
    const url =  new URL(origin + '/img');
    url.searchParams.set('url', imgSrc);
    url.searchParams.set('resize', _resizeFraction);
    if (_transform) url.searchParams.set('transform', _transform);
    setOutput(`Calling Cloudflare Worker...`);
    (async function() {
        let fetchTime, readTime;
        const serverTimes = new Map();
        const updateTimes = () => {
            const pieces = [];
            let fetchText = `Fetch: ${fetchTime}ms`;
            if (serverTimes.size > 0) {
                const pieces2 = [];
                for (const [ name, dur ] of serverTimes) {
                    pieces2.push(`${name}: ${dur}ms`);
                }
                fetchText += ` (${pieces2.join(', ')})`;
            }
            pieces.push(fetchText);
            if (readTime) pieces.push(`Read: ${readTime}ms`);
            setOutput(pieces.join(', '));
        };
        try {
            let start = Date.now();
            const res = await fetch(url.toString());
            fetchTime = Date.now() - start;
            updateTimes();
            outputLink.href = url.toString();
            // console.log(res);
            if (res.status !== 200) {
                const text = await res.text();
                if (res.status === 503 && text.includes('Worker exceeded resource limits')) {
                    throw new Error(`Worker exceeded resource limits`);
                }
                throw new Error(`Unexpected status ${res.status}`);
            }
            const serverVars = [];
            const serverTimings = (res.headers.get('server-timing') ?? '').split(', ').filter(v => v !== '');
            for (const serverTiming of serverTimings) {
                if (!serverTiming.startsWith('cf')) { // cf started adding server-timing headers in late 2024: cfL4;desc="?proto=QUIC&
                    for (const piece of serverTiming.split(',')) {
                        const m = /^([a-z-]+);(dur=(\d+);)?desc="(.*?)"$/.exec(piece);
                        if (!m) throw new Error(`Unexpected server timing: ${piece}`);
                        const [ _line, name, _, dur, desc ] = m;
                        if (dur) {
                            serverTimes.set(desc, parseInt(dur));
                        } else {
                            serverVars.push(`${name}: ${desc.replaceAll('x', '×')}`);
                        }
                    }
                }
            }
            setOutput2(serverVars.join(', '));
           
            start = Date.now();
            const blob = await res.blob();
            readTime = Date.now() - start;
            updateTimes();
            outputImg.src = URL.createObjectURL(blob);
        } catch (e) {
            setOutput2(`${e}`);
        }
    })();
}

function setOutput(text) {
    if (!_output) _output = document.getElementById('output1');
    _output.textContent = text;
}

function setOutput2(text) {
    if (!_output2) _output2 = document.getElementById('output2');
    _output2.textContent = text;
}

function parseStaticData() {
    const script = document.getElementById('static-data-script');
    const { imgOrigin } = JSON.parse(script.text);
    if (typeof imgOrigin === 'string') _imgOrigin = imgOrigin;
}

globalThis.addEventListener('DOMContentLoaded', (event) => {
    setOutput('DOMContentLoaded');
    parseStaticData();
    selectImage();
    updateResizeLabel(document.getElementById('resize'));
    updateParamVisibility();
});
