// adapted from https://deno.land/x/pngs@0.1.1/mod.ts

/* OLD
import init, {
  decode as wasmDecode,
  encode as wasmEncode,
  source,
} from "./wasm.js";

await init(source);
*/

// NEW

import { importWasm } from '../deps_worker.ts';
const pngsModule = await importWasm(import.meta.url, './pngs_bg.wasm');
import pngsInit, { decode as wasmDecode, encode as wasmEncode } from './pngs_bg.js';
await pngsInit(pngsModule);

//

type ValueOf<T> = T[keyof T];

export const ColorType = {
  Grayscale: 0,
  RGB: 2,
  Indexed: 3,
  GrayscaleAlpha: 4,
  RGBA: 6,
};

export const BitDepth = {
  One: 1,
  Two: 2,
  Four: 4,
  Eight: 8,
  Sixteen: 16,
};

export const Compression = {
  Default: 0,
  Fast: 1,
  Best: 2,
  Huffman: 3,
  Rle: 4,
};

export const FilterType = {
  NoFilter: 0,
  Sub: 1,
  Up: 2,
  Avg: 3,
  Paeth: 4,
};

export interface DecodeResult {
  image: Uint8Array;
  width: number;
  height: number;
  colorType: ValueOf<typeof ColorType>;
  bitDepth: ValueOf<typeof BitDepth>;
  lineSize: number;
}

export function encode(
  image: Uint8Array,
  width: number,
  height: number,
  options?: {
    palette?: Uint8Array;
    trns?: Uint8Array;
    color?: ValueOf<typeof ColorType>;
    depth?: ValueOf<typeof BitDepth>;
    compression?: ValueOf<typeof Compression>;
    filter?: ValueOf<typeof FilterType>;
    stripAlpha?: boolean;
  },
): Uint8Array {
  if (options?.stripAlpha) {
    image = image.filter((_, i) => (i + 1) % 4);
  }

  return wasmEncode(
    image,
    width,
    height,
    options?.palette,
    options?.trns,
    options?.color ?? ColorType.RGBA,
    options?.depth ?? BitDepth.Eight,
    options?.compression,
    options?.filter,
  );
}

export function decode(image: Uint8Array): DecodeResult {
  const res = wasmDecode(image);

  return {
    image: new Uint8Array(res.image),
    width: res.width,
    height: res.height,
    colorType: res.colorType,
    bitDepth: res.bitDepth,
    lineSize: res.lineSize,
  };
}