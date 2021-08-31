# tailweb

https://tail.denoflare.dev

View live requests and logs from Cloudflare Workers from the comfort of your browser. 
A few enhancements over what's provided by default in the Cloudflare dashboard:

- Tail multiple workers at the same time
- Advanced filtering and multi-color output similar to wrangler tail
- Durable object class/name/id and colo information can be surfaced with logprops
- Multiple profiles, switch easily between multiple accounts
- No need to log in with your full Cloudflare credentials. Profiles are stored locally in the browser, and can be permissioned only for tailing workers
- Implemented as an open-source Cloudflare Worker, deploy it to your own account, or host it locally with `denoflare`

## logprops
Enhance the tail output by including additional information about each request!

You can provide additional properties to requests by calling `console.log` with a special prefix: `logprops:` and including the properties as a JSON object with string properties.

e.g. to provide the `colo` for a Durable Object request (which does not include colo information by default):
```ts
console.log(`logprops: ${JSON.stringify({ colo: 'DFW' })}`);
```
or, even easier, as an additional object arg
```ts
console.log('logprops:', { colo: 'DFW' });
```

Currently, tailweb surfaces the following properties in its tail output, if provided by the worker:
 - `colo`: useful for DO requests which do not include this information by default, e.g. `DFW`
 - `durableObjectClass`: name of the current Durable Object class, e.g. `MyCounterDO`
 - `durableObjectId`: hex id of the current Durable Object instance, available via `state.id` e.g. `538fc7ce55b14e53b6b8552befeb9af4`
 - `durableObjectName`: name used in the `idFromName` call, you need to pass this down yourself in each DO `fetch` call

## Deploy it to your own account

Since it is a standard module-based Cloudflare Worker, you can deploy it like any other worker with `denoflare push`:

```sh
denoflare push --name tail https://raw.githubusercontent.com/skymethod/denoflare/v0.1.0/tailweb-worker/tailweb_worker.ts
```

## Host it locally

Since it is a standard module-based Cloudflare Worker, you can serve it locally like any other worker with `denoflare serve`:

```sh
denoflare serve https://raw.githubusercontent.com/skymethod/denoflare/v0.1.0/tailweb-worker/tailweb_worker.ts
```
