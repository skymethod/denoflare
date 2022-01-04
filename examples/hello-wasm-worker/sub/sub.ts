import { importWasm } from 'https://raw.githubusercontent.com/skymethod/denoflare/v0.4.0/common/import_wasm.ts';
const module = await importWasm(import.meta.url, './hello2.wasm'); // rewritten to: import module from './sub/hello2.wasm';

export function callSub(): number {
    // call hello2.wasm
    const instance = new WebAssembly.Instance(module);
    return (instance.exports.main as CallableFunction)();
}
