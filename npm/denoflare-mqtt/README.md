`denoflare-mqtt` is a lightweight MQTT v5 client for Deno, Node, and the browser.

A [Denoflare](https://denoflare.dev) subproject.

Carefully packaged so that it can be used from either newer-style ESM-based or older-style CommonJS-based Node projects.

Written using Deno, so also can be used via remote importing without this NPM package at all (see Deno example below).

## Features
- Isomorphic, use in the browser, Node, or Deno
- No dependencies, bring your own WebSocket/Blob polyfills if necessary in your environment
- TypeScript typings included
- Implements MQTTv5, and only the features currently implemented by [Cloudflare Pub/Sub](https://developers.cloudflare.com/pub-sub/)

## Documentation
See the API docs in [mqtt_client.ts](https://github.com/skymethod/denoflare/blob/master/common/mqtt/mqtt_client.ts) for now. 

These are also used to generate [TypeScript typings for this NPM package](https://github.com/skymethod/denoflare/blob/master/npm/denoflare-mqtt/main.d.ts), so you'll get them as hover documentation in your IDE.

This package is a convenience for Node environments.  It is not necessary at all in Deno or client-side via module-imports in the browser, since both support remote importing modules by url.

See the [source module documentation](https://github.com/skymethod/denoflare/tree/master/common/mqtt) for more info.

## Example usage in an ESM-based Node project

Installation:
```sh
# for WebSocket (Node still doesn't have this?)
npm install ws
npm install isomorphic-ws
# for Blob (only needed on Node v14 or below)
npm install cross-blob
# this package
npm install denoflare-mqtt
```

`example.mjs`
```js
import { MqttClient, DISCONNECT } from 'denoflare-mqtt';
import isomorphicWs from 'isomorphic-ws';
import Blob from 'cross-blob';

globalThis.WebSocket = isomorphicWs.WebSocket;
globalThis.Blob = Blob;

const protocol = 'wss';
const hostname = 'broker.example.com';
const port = 8884;

const topic = 'my-topic';
const payload = 'hello world!';

const client = new MqttClient({ hostname, port, protocol });

client.onMqttMessage = message => {
    if (message.type === DISCONNECT) {
        console.log('disconnect', message.reason);
    }
};

console.log('connecting');
await client.connect({ clientId, password, keepAlive });

const { clientId, keepAlive } = client;
console.log('connected', { clientId, keepAlive });

console.log(`publishing`);
await client.publish({ topic, payload });

console.log('disconnecting');
await client.disconnect();

console.log('disconnected');
```

## Example usage in a CommonJS-based Node project

Installation:
```sh
# for WebSocket (Node still doesn't have this?)
npm install ws
npm install isomorphic-ws
# for Blob (only needed on Node v14 or below)
npm install cross-blob
# this package
npm install denoflare-mqtt
```

`example.js`
```js
const { MqttClient, DISCONNECT } = require('denoflare-mqtt');
const isomorphicWs = require('isomorphic-ws');
const Blob = require('cross-blob');

globalThis.WebSocket = isomorphicWs.WebSocket;
globalThis.Blob = Blob;

async function run() {
    const protocol = 'wss';
    const hostname = 'broker.example.com';
    const port = 8884;

    const topic = 'my-topic';
    const payload = 'hello world!';

    const client = new MqttClient({ hostname, port, protocol });

    client.onMqttMessage = message => {
        if (message.type === DISCONNECT) {
            console.log('disconnect', message.reason);
        }
    };

    console.log('connecting');
    await client.connect({ clientId, password, keepAlive });

    const { clientId, keepAlive } = client;
    console.log('connected', { clientId, keepAlive });

    console.log(`publishing`);
    await client.publish({ topic, payload });

    console.log('disconnecting');
    await client.disconnect();

    console.log('disconnected');
}

run(); // no top-level await when using CommonJS

```
