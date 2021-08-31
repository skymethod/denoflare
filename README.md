# denoflare
Develop, test, and deploy Cloudflare Workers with Deno.

[denoflare.dev](https://denoflare.dev)

## tailweb (tail.denoflare.dev)

View live requests and logs from Cloudflare Workers from the comfort of your browser. [Learn more](./tailweb.md)

## `denoflare` cli

Denoflare cli is a standard Deno program, so it benefits from the permission model and installation flexibility of all Deno programs.

Since Denoflare is still under active development, it's easiest to simply "install" it by making a shell alias to a `deno run` command:

```sh
alias denoflare='deno run --unstable --allow-read --allow-net --allow-env https://raw.githubusercontent.com/skymethod/denoflare/0.1.0/cli/cli.ts'
```

