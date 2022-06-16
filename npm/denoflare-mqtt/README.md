`denoflare-mqtt` is a lightweight MQTT v5 client for Deno, Node, and the browser.

A [Denoflare](https://denoflare.dev) subproject.

Carefully packaged so that it can be used from either newer-style ESM-based or older-style CommonJS-based Node projects.

Written using Deno, so also can be used via remote importing without this NPM package at all (see Deno example below).

## Features
- Isomorphic, use in the browser, Node, or Deno
- No dependencies
- TypeScript typings included

## Documentation
See the API docs in [mqtt_client.ts](https://github.com/skymethod/denoflare/blob/master/common/mqtt/mqtt_client.ts) for now. 

These are also used to generate TypeScript typings for this NPM package, so you'll get them as hover documentation in your IDE.

## Example usage in an ESM-based Node project

Installation:
```sh
npm install denoflare-mqtt
```

`example.mjs`
```js
import { MqttClient, DISCONNECT } from 'denoflare-mqtt';

const protocol = 'wss';
const hostname = 'broker.example.com';
const port = 8883;

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
npm install denoflare-mqtt
```

`example.js`
```js
const { MqttClient, DISCONNECT } = require('denoflare-mqtt');

async function run() {
    const protocol = 'wss';
    const hostname = 'broker.example.com';
    const port = 8883;

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

## Example usage in a [Deno](https://deno.land) project
You don't need this NPM package or to install anything, just remote-import `mqtt_client.ts` from the source repo

`example.ts`
```ts
import { MqttClient, DISCONNECT } from 'https://raw.githubusercontent.com/skymethod/denoflare/TODO/common/mqtt/mqtt_client.ts';

const protocol = 'wss';
const hostname = 'broker.example.com';
const port = 8883;

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
