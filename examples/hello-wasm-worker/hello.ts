import { importWasm } from 'https://raw.githubusercontent.com/skymethod/denoflare/v0.4.0/common/import_wasm.ts';
import { callSub } from './sub/sub.ts'; // also works with relative module specifiers within relative imports
const module = await importWasm(import.meta.url, './hello.wasm'); // rewritten to: import module from './hello.wasm';

export default {

    fetch(): Response {
        try {
            // call hello.wasm
            const instance = new WebAssembly.Instance(module);
            const result = (instance.exports.main as CallableFunction)();

            // call hello2.wasm
            const subresult = callSub();

            const html = `<h3>Result from hello.wasm call: ${result}</h3><h3>Result from hello2.wasm call: ${subresult}</h3>`;
            return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        } catch (e) {
            const html = `${e}`;
            return new Response(html, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
    }

};
