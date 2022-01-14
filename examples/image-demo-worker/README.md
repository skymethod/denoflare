# Transform Images in a Cloudflare Worker

This example Cloudflare Worker fetches an image, applies transforms from the [Photon](https://silvia-odwyer.github.io/photon/) wasm library, then encodes to PNG using wasm from the [pngs](https://github.com/denosaurs/pngs) deno module.

You can deploy the [module worker](worker.ts) to your own Cloudflare account by adding the script def to your [`.denoflare`](https://denoflare.dev/cli/configuration) file...

```jsonc
    "image-demo": {
        "path": "/path/to/this/image-demo-worker/worker.ts",
        "bindings": {
            "unsplashAppName": { "value": "image_demo_worker" },
            "unsplashIxid": { "value": "MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8" },
        },
        "usageModel": "unbound",
    },
```
... then pushing to Cloudflare
```sh
denoflare push image-demo
```

It runs as an `unbundled` worker, but you will eventually hit the Workers CPU limits with some of the transforms, so it's recommended to use `unbound` as the usage model.

The size of the uploaded script + favicons/metadata images + all wasm modules is 734kb compressed.

---
## WebAssembly notes
This worker uses Denoflare's new [WebAssembly import support](https://denoflare.dev/reference/wasm), the unmodified .wasm files from their respective third party libraries, and slightly tweaked js binding files (see the `/ext` subdir).

The WebAssembly libraries are loaded and used in the [`/img`](img.ts) endpoint.
