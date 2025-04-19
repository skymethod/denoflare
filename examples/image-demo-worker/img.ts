import { importWasm } from './deps_worker.ts';
const photonModule = await importWasm(import.meta.url, './ext/photon_rs_bg.wasm');
import * as photon from './ext/photon_rs_bg.js';
import { encode } from './ext/pngs.ts';

export async function computeImg(searchParams: URLSearchParams, opts: { colo: string }): Promise<Response> {
    const { colo } = opts;
    let inputImage: photon.PhotonImage | undefined;
    let outputImage: photon.PhotonImage | undefined;
    const timings = new ServerTimings();
    timings.set('req-no', `${_requestNum++}`);
    timings.set('colo', colo);
    try {
        const url = checkUrl(searchParams);
        const resize = checkResize(searchParams);
        let start = Date.now();
        const res = await fetch(url);
        timings.set('fetch-image', 'Fetch image', Date.now() - start);
        if (res.status !== 200) throw new Error(`Unexpected status: ${res.status}, expected 200 for ${url}`);
        const contentType = res.headers.get('content-type') || '<missing>';
        console.log([...res.headers]);
        if (!contentType.startsWith('image/')) throw new Error(`Unexpected content-type: ${contentType}, expected image/* for ${url}`);
        start = Date.now();
        const bytes = await res.arrayBuffer();
        timings.set('read-image', 'Read image', Date.now() - start);
        const arr = new Uint8Array(bytes);
        console.log('arr.length', arr.length);

        start = Date.now();
        await ensurePhotonLoaded();
        timings.set('load-photon', 'Load Photon', Date.now() - start);

        // console.log(new Bytes(arr.slice(0, 8)).hex());
        inputImage = photon.PhotonImage.new_from_byteslice(arr);
        console.log('inputImage', inputImage);
        addImageInfo('input', inputImage, arr, timings);
        
        outputImage = inputImage;

        if (resize !== 1) {
            outputImage = photon.resize(inputImage, inputImage.get_width() * resize, inputImage.get_height() * resize, 1);
            inputImage.free(); inputImage = undefined;
        } else {
            inputImage = undefined;
        }

        const transform = searchParams.get('transform') || undefined;
        if (transform) {
            const m = /^([a-zA-Z0-9_]+)\((.*?)\)$/.exec(transform);
            if (m) {
                const fnName = m[1];
                const rgbs: photon.Rgb[] = [];
                const args = m[2].split(',').filter(v => v !== '').map(v => {
                    const [ value, kind ] = v.split(':');
                    if (kind === 'int' || kind === 'channel') {
                        return parseInt(value);
                    } else if (kind === 'float') {
                        return parseFloat(value);
                    } else if (kind === 'string') {
                        return value;
                    } else if (kind === 'rgb') {
                        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(value);
                        if (!m) throw new Error(`Bad rgb value: ${value}`);
                        const r = parseInt(m[1], 16);
                        const g = parseInt(m[2], 16);
                        const b = parseInt(m[3], 16);
                        const rgb = new photon.Rgb(r, g, b);
                        rgbs.push(rgb);
                        return rgb;
                    } else {
                        throw new Error(v);
                    }
                });
                console.log(fnName, ...args);
                // deno-lint-ignore no-explicit-any
                const fn = (photon as any)[fnName];
                if (typeof fn === 'function') {
                    fn(outputImage, ...args);
                }
            }
        }
        const outputPng = encode(outputImage.get_raw_pixels(), outputImage.get_width(), outputImage.get_height());
        addImageInfo('output', outputImage, outputPng, timings);
        outputImage.free(); outputImage = undefined;

        return new Response(outputPng, { headers: makeHeaders('image/png', timings) });
    } catch (e) {
        console.error(e);
        return new Response(`${(e as Error).stack || e}`, { status: 500,  headers: makeHeaders('application/json', timings) });
    } finally {
        if (inputImage && inputImage.ptr !== 0) inputImage.free();
        if (outputImage && outputImage.ptr !== 0) outputImage.free();
    }
}

//

const RESIZE_FRACTIONS = [ 0.25, 0.50, 1, 1.25, 1.5];

let _requestNum = 1;

let _photonInstance: WebAssembly.Instance | undefined;

async function ensurePhotonLoaded() {
    if (_photonInstance) return;
    // deno-lint-ignore no-explicit-any
    _photonInstance = await WebAssembly.instantiate(photonModule, { './photon_rs_bg.js': photon as any });
    photon.setWasm(_photonInstance.exports);
}

function checkUrl(searchParams: URLSearchParams): string {
    const url = searchParams.get('url');
    if (typeof url === 'string') {
        const u = new URL(url);
        if (u.origin === 'https://images.unsplash.com') {
            return url;
        }
    }
    throw new Error(`Bad url: ${url}`);
}

function checkResize(searchParams: URLSearchParams): number {
    const resize = searchParams.get('resize');
    if (resize) {
        try {
            const resizeFloat = parseFloat(resize);
            if (RESIZE_FRACTIONS.includes(resizeFloat)) {
                return resizeFloat;
            }
        } catch { 
            // noop
        }
    }
    return 1;
}

function makeHeaders(contentType: string, timings: ServerTimings): Headers {
    return timings.addToHeaders(new Headers({ 
        'content-type': contentType, 
        'access-control-allow-origin': '*',
        'access-control-expose-headers': '*',
     }));
}

function addImageInfo(name: string, image: photon.PhotonImage, imageBytes: Uint8Array, timings: ServerTimings) {
    const size = computeSize(imageBytes.length);
    timings.set(name, `${image.get_width()}x${image.get_height()} (${size})`);
}

function computeSize(bytes: number): string {
    const kb = bytes / 1024;
    if (kb > 999) return `${(kb / 1024).toFixed(2)}mb`;
    return `${kb.toFixed(2)}kb`;
}

//

class ServerTimings {
    private pieces: string[] = [];

    set(name: string, desc: string, dur?: number) {
        if (dur === 0) return;
        this.pieces.push(`${name};${dur ? `dur=${dur};` : ''}desc="${desc}"`);
    }

    addToHeaders(headers: Headers): Headers {
        headers.set('server-timing', this.pieces.join(','));
        return headers;
    }
}
