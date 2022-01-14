import { importText } from './deps_worker.ts';
import { encodeHtml, HtmlContribution } from './html.ts';
import { Theme } from './theme.ts';
import { Transform } from './transforms.ts';
const HOMEPAGE_JS = await importText(import.meta.url, './homepage.js');
const TRANFORMS = await importText(import.meta.url, './transforms.json');

export function computeHomepage(opts: { name: string, description: string, origin: string, twitterImagePathname: string, twitter?: string, unsplashAppName?: string, unsplashIxid?: string, imgOrigin?: string, authorName?: string, authorHref?: string }): HtmlContribution {

    const { name, description, origin, twitterImagePathname, twitter, unsplashAppName, unsplashIxid, imgOrigin, authorName, authorHref } = opts;

    const img1: UnsplashImage = { id: 'gmj0qzWMtjo', userName: 'Gaurav Kumar', url: `https://images.unsplash.com/photo-1626116809152-858f5c6c061c?fm=png&ixid=${unsplashIxid}&ixlib=rb-1.2.1&q=80&w=810` };
    const img2: UnsplashImage = { id: 'REjuIrs2YaM', userName: 'Daniel J. Schwarz', url: `https://images.unsplash.com/photo-1606318005254-bdb2bcd14d34?fm=png&ixid=${unsplashIxid}&ixlib=rb-1.2.1&q=80&w=810` };
    const img3: UnsplashImage = { id: 'gOn7dKcCWKg', userName: 'Nathan Dumlao', url: `https://images.unsplash.com/photo-1514481538271-cf9f99627ab4?fm=png&ixid=${unsplashIxid}&ixlib=rb-1.2.1&q=80&w=810` };
    const img4: UnsplashImage = { id: 'K88mzn884MQ', userName: 'Daniele Levis Pelusi', url: `https://images.unsplash.com/photo-1619350447432-c7f01f6afc01?fm=png&ixid=${unsplashIxid}&ixlib=rb-1.2.1&q=80&w=810` };

    const imgs = [img1, img2, img3, img4];

    let transforms: Transform[] = JSON.parse(TRANFORMS);
    transforms = transforms.filter(v => v.name !== 'selective_greyscale'); // TODO rust binding seems broken
    transforms.unshift({ name: '(no transform)', parameters: [] });

const headContribution = `
  <meta name="description" content="${encodeHtml(description)}">
  <meta property="og:title" content="${encodeHtml(name)}">
  <meta property="og:description" content="${encodeHtml(description)}">
  <meta property="og:image" content="${origin}${twitterImagePathname}">
  <meta property="og:image:alt" content="${encodeHtml(name)} screenshot">
  <meta property="og:locale" content="en_US">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  ${twitter ? `<meta name="twitter:site" content="${twitter}">` : ''}
  <meta property="og:url" content="${origin}">
  <link rel="canonical" href="${origin}">
  <script id="static-data-script" type="application/json">${JSON.stringify({ imgOrigin })}</script>
  <script>
${HOMEPAGE_JS}
  </script>
  <style>
    *::-webkit-scrollbar {
      background: rgba(255, 255, 255, 0.1);
    }
    *::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.5);
    }
  </style>
  <style type="text/tailwindcss">
  @layer utilities {
    .selected-image {
      outline: solid 0.25rem rgba(3, 105, 161, 0.75);
      outline-offset: -0.25rem;
      @apply opacity-100;
    }
    .line-clamp {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }
  </style>`;

const aClass = `hover:underline text-sky-400 underline-offset-2`;
const authorHtml = authorName && authorHref ? ` by <a href="${authorHref}" class="${aClass}" target="_blank">${authorName}</a>` : '';
const body = `
<body class="bg-[${Theme.backgroundColorHex}] text-white container mx-auto md:max-w-none md:grid md:grid-cols-2 md:mx-0 md:gap-x-4">
    <div class="h-[50vh] overflow-y-hidden fixed top-0 left-0 md:overflow-y-visible md:relative">
        <div class="m-4">
            <h1>Transform Images in a <a class="hover:underline underline-offset-2" href="https://workers.cloudflare.com/" target="_blank">Cloudflare Worker</a></h1>
            <div class="text-sm">
                <div class="leading-5">Using WebAssembly from <a href="https://silvia-odwyer.github.io/photon/" class="${aClass}" target="_blank">Photon</a> and <a href="https://github.com/denosaurs/pngs" class="${aClass}" target="_blank">pngs</a></div>
                <div class="leading-5 mb-4">Made with <a href="https://denoflare.dev" class="${aClass}" target="_blank">Denoflare</a> (<a href="https://github.com/skymethod/denoflare/tree/master/examples/image-demo-worker" class="${aClass}" target="_blank">source code</a>)${authorHtml}</div>
                <div class="opacity-50">
                    <div id="output1" class="line-clamp text-sm leading-5">This demo needs JavaScript to run</div>
                    <div id="output2" class="line-clamp text-sm leading-5"></div>
                    <div>Original image by <a id="unsplash-link" href="#" class="${aClass}" target="_blank">John Doe</a> via <a href="https://unsplash.com/?utm_source=${unsplashAppName}&utm_medium=referral" class="${aClass}" target="_blank">Unsplash</a></div>
                </div>
            </div>
        </div>
        <a id="output-link" href="#" target="_blank" title="Open output image ↗️"><img id="output" class="bg-slate-700 object-contain mx-auto max-w-[70%] max-h-[20vh] sm:max-h-[40vh] sm:max-w-[70%] md:max-w-[100%] md:mx-0 md:max-h-[100%]" /></a>
    </div>
    <div class="h-[50vh] md:hidden bg-[${Theme.backgroundColorHex}]"></div>
    <div class="h-[50vh] flex flex-col overflow-y-scroll overflow-x-auto text-sm md:h-[inherit] md:h-screen">
        <div id="imageSelector" class="flex-none flex flex-row overflow-x-auto mt-4 mb-4" onclick="selectImage(event.target)">
${imgs.map(v => '            ' + computeImageSelectionBox(v, unsplashAppName)).join('\n')}
        </div>
        <form id="transforms" autocomplete="off" class="flex-shrink grid grid-cols-[auto_6rem_1fr] items-center gap-1 cursor-pointer select-none pr-4 gap-x-4 ml-4 accent-sky-700">
            <div></div><label id="resize_value" class="" for="resize">resize</label>
            <input type="range" id="resize" name="resize" class="cursor-pointer" min="0" max="4" value="2" step="1" oninput="onResizeInput(this)" onchange="onResizeChange(this)"/>
            <hr class="col-span-3 my-2 opacity-50" />
${transforms.map(v => '            ' + computeTransformElements(v)).join('\n')}
        </form>
    </div>
</body>`;
    return { title: name, headContribution, body };
}

//

function computeImageSelectionBox(img: UnsplashImage, unsplashAppName?: string): string {
    return `<img class="object-cover h-48 w-48 opacity-75 hover:opacity-100 cursor-pointer" src="${img.url}" data-unsplash-id="${img.id}" data-unsplash-app-name="${encodeHtml(unsplashAppName || '')}" data-unsplash-user-name="${encodeHtml(img.userName)}" />`;
}

function computeTransformElements(transform: Transform): string {
    const { name } = transform;
    let control = `<div></div><div></div>`;
    if (transform.parameters.length === 1) {
        const { name: paramName, type } = transform.parameters[0];
        const id = `${name}_${paramName}`;
        control = `<div id="${id}_value" class="text-right" data-transform="${name}"></div>`;
        if (type.kind === 'float') {
            const step = type.min === 0 && type.max === 1 ? 0.01 : 1;
            const value = type.default || 0;
            control += `<input type="range" data-transform="${name}" data-kind="${type.kind}" class="cursor-pointer" id="${id}" name="${id}" min="${type.min}" max="${type.max}" step="${step}" value="${value}" oninput="onTransformParamInput(this)" onchange="onTransformParamChange(this)"/>`;
        } else if (type.kind === 'int') {
            const value = type.default || 0;
            control += `<input type="range" data-transform="${name}" data-kind="${type.kind}" class="cursor-pointer" id="${id}" name="${id}" min="${type.min}" max="${type.max}" step="1" value="${value}" oninput="onTransformParamInput(this)" onchange="onTransformParamChange(this)"/>`;    
        } else if (type.kind === 'enum') {
            control += `<input type="range" data-transform="${name}" data-kind="${type.kind}" data-values="${type.values.join(',')}", class="cursor-pointer" id="${id}" name="${id}" min="0" max="${type.values.length-1}" step="1" value="0" oninput="onTransformParamInput(this)" onchange="onTransformParamChange(this)"/>`;
        } else if (type.kind === 'channel') {
            control += `<input type="range" data-transform="${name}" data-kind="${type.kind}" data-values="red,green,blue", class="cursor-pointer" id="${id}" name="${id}" min="0" max="2" step="1" value="0" oninput="onTransformParamInput(this)" onchange="onTransformParamChange(this)"/>`;
        } else if (type.kind === 'rgb') {
            control += `<input type="color" data-transform="${name}" data-kind="${type.kind}" id="${id}" name="${id}" value="#ff0000" oninput="onTransformParamInput(this)" onchange="onTransformParamChange(this)"/>`;
        } else {
            throw new Error();
        }
    }
    return `<input type="radio" id="${name}" name="transform" class="cursor-pointer"${name === '(no transform)' ? ' checked' : ''} onchange="onTransformChange(this)"><label for="${name}" class="cursor-pointer col-span-2">${encodeHtml(name)}</label><div></div>${control}`;
}

//

interface UnsplashImage {
    readonly id: string;
    readonly url: string;
    readonly userName: string;
}
