## multiplat-worker

Write once, run on Cloudflare Workers / Deno Deploy / AWS Lambda / Supabase Edge Functions!


https://github.com/skymethod/denoflare/assets/47259736/c0150bde-1df0-4f9e-b9c2-e6043dee2228


[Denoflare](https://denoflare.dev) now has experimental support for deploying ESM-based Typescript workers not only to [Cloudflare Workers](https://workers.cloudflare.com/), but the same code to:
 - [Deno Deploy](https://deno.com/deploy)
 - [AWS Lambda](https://aws.amazon.com/lambda/), via [public function URLs](https://docs.aws.amazon.com/lambda/latest/dg/lambda-urls.html)
 - [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

... _without_ `wrangler`, `deployctl`, the `supabase` cli, or the `aws` sdk

### Standard interface

Denoflare provides a single, common interface (the Cloudflare module-based [fetch handler interface](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)) for handling the request, reading environment variables, incoming IP address, region, and even importing static text, binary or Wasm modules.

### This example

See [`multiplat.ts`](https://github.com/skymethod/denoflare/blob/master/examples/multiplat-worker/multiplat.ts) in this directory for a basic example worker that dumps out some environment info, runs some Wasm, serves an imported binary asset.

> See it running on Deno Deploy at [multiplat-example.deno.dev](https://multiplat-example.deno.dev), which has links to the same code running on the other platforms.

To deploy it yourself, you can use the [`denoflare`](https://denoflare.dev/cli/) cli (or, since it's just a [Deno](https://deno.com/) script, the install-less version on CI), and use:
 - [`denoflare push`](https://denoflare.dev/cli/push) to deploy to Cloudflare
 - [`denoflare push-deploy`](https://denoflare.dev/cli/push-deploy) to deploy to Deno Deploy
 - [`denoflare push-lambda`](https://denoflare.dev/cli/pus-lambda) to deploy to AWS Lambda
 - [`denoflare push-supabase`](https://denoflare.dev/cli/push-supabase) to deploy to Supabase

While each command takes various platform-specific configuration options, you can also use a single configuration element in your denoflare.jsonc file.

```jsonc
    "multiplat-example": {
        "path": "/MY/PATH/TO/denoflare/examples/multiplat-worker/multiplat.ts", // or https:// url
        "bindings": {
            "secret": { "secret": "open-sesame" },
        },
        "supabase": "project-ref=MY_SUPABASE_PROJECT_REF,access-token=MY_SUPABASE_ACCESS_TOKEN",
        "deploy": "access-token=MY_DENO_DEPLOY_ACCESS_TOKEN",
        "lambda": "architecture=arm,region=us-east-1,architecture=arm,memory=128,storage=512,timeout=3,profile=MY_AWS_PROFILE_IN_AWS_CREDENTIALS,role=arn:aws:iam::MY_AWS_ACCOUNT_ID:role/MY_IAM_ROLE",
    }
```

Each of the new `push` commands have the familiar `--watch` mode, for automatically pushing any local changes during development

```sh
$ denoflare push multiplat-example --watch
$ denoflare push-deploy multiplat-example --watch
$ denoflare push-lambda multiplat-example --watch
$ denoflare push-supabase multiplat-example --watch
```

### But... these edge runtimes are all different, with different abstractions + tools - how does this work?

- For Cloudflare, scripts are bundled locally and deployed via the Cloudflare REST API, all part of `denoflare push`

- For Deno Deploy, a common runtime app is used to adapt the constrained Deno runtime to the common fetch interface, packaged locally and deployed via the Deno Deploy REST API, all part of `denoflare push-deploy`

- For AWS Lambda, a minimal reusable [layer](https://docs.aws.amazon.com/lambda/latest/dg/chapter-layers.html) is automatically created for the given Deno version (ARM supported!), with a minimal [custom runtime](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html) running on the latest [Amazon Linux 2023](https://aws.amazon.com/linux/amazon-linux-2023/) base, deployed/configured via the AWS REST API, all part of `denoflare push-lambda`

- For Supabase Edge Functions, worker/runtime/assets are bundled into single eszip locally (no docker needed!) and deployed via the Supabase Management REST API, all part of `denoflare push-supabase`

- The gory details can be found in the associated cli command entry points here in the denoflare repo, everything is [open source](https://github.com/skymethod/denoflare/tree/master/cli).
