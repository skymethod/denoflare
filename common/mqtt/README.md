`denoflare-mqtt` is a lightweight MQTT v5 client for Deno, Node, and the browser.

A [Denoflare](https://denoflare.dev) subproject.

Most of the source is right here in this source subfolder.

## Features
- Isomorphic, use in the browser, Node, or Deno
- Implements MQTTv5, and only the features currently implemented by [Cloudflare Pub/Sub](https://developers.cloudflare.com/pub-sub/)

## Demo

- [denoflare-mqtt demo](https://mqtt.denoflare.dev/): Publish and subscribe from your browser, no server in the middle.

## Documentation
The `MqttClient` class in [mqtt_client.ts](https://github.com/skymethod/denoflare/blob/master/common/mqtt/mqtt_client.ts) is the main client class.

In the Deno runtime, remote-import the Deno module [mod_deno.ts](https://github.com/skymethod/denoflare/blob/master/common/mqtt/mod_deno.ts) - which includes both 'wss' and 'mqtts' (tcp) protocol support.
```ts
import { MqttClient } from 'https://raw.githubusercontent.com/skymethod/denoflare/denoflare-mqtt-v0.0.1/common/mqtt/mod_deno.ts';
```

### ESM bundle

The isomorphic Deno module [mod_iso.ts](https://github.com/skymethod/denoflare/blob/master/common/mqtt/mod_iso.ts) includes only the 'wss' protocol, and relies on browser standards, no Deno-specific apis.

For convenience, we bundle the isomorphic Deno module into a single-file [standard ESM JavaScript module](https://github.com/skymethod/denoflare/blob/master/npm/denoflare-mqtt/esm/main.js) which can be module-imported inside browsers.
```js
import { MqttClient } from 'https://cdn.jsdelivr.net/gh/skymethod/denoflare@denoflare-mqtt-v0.0.1/npm/denoflare-mqtt/esm/main.js';
// esm module from npm package source served from jsdelivr with the correct mime type for browsers
```

### NPM
[`denoflare-mqtt`](https://www.npmjs.com/package/denoflare-mqtt) is an NPM package that includes this ESM module (and a corresponding CJS module) along with the [TypeScript typings](https://github.com/skymethod/denoflare/blob/master/npm/denoflare-mqtt/main.d.ts) for hover documentation in your IDE.

See the [package README](https://www.npmjs.com/package/denoflare-mqtt) for example usage in Node.

## Example: Connect, publish a single message, and disconnect

> See the [Cloudflare Pub/Sub Get started guide](https://developers.cloudflare.com/pub-sub/get-started/guide/) for setting up your namespace, broker, and credentials

```js
...
// Once you've imported `MqttClient` per your environment (see above)

const protocol = 'wss';
const hostname = 'my-broker.my-namespace.cloudflarepubsub.com';
const port = 8884;
const maxMessagesPerSecond = 10; // current beta limit: https://developers.cloudflare.com/pub-sub/platform/limits/

const topic = 'my-topic';
const payload = 'hello world!';

const password = 'JWT TOKEN HERE';

const client = new MqttClient({ hostname, port, protocol, maxMessagesPerSecond });

client.onMqttMessage = message => {
    if (message.type === DISCONNECT) {
        console.log('disconnect', message.reason);
    }
};

console.log('connecting');
await client.connect({ password });

const { clientId, keepAlive } = client;
console.log('connected', { clientId, keepAlive });

console.log(`publishing`);
await client.publish({ topic, payload });

console.log('disconnecting');
await client.disconnect();

console.log('disconnected');
```

## Example: Connect, subscribe to receive messages for a given topic

> See the [Cloudflare Pub/Sub Get started guide](https://developers.cloudflare.com/pub-sub/get-started/guide/) for setting up your namespace, broker, and credentials

```js
...
// Once you've imported `MqttClient` per your environment (see above)

const protocol = 'wss';
const hostname = 'my-broker.my-namespace.cloudflarepubsub.com';
const port = 8884;
const maxMessagesPerSecond = 10; // current beta limit: https://developers.cloudflare.com/pub-sub/platform/limits/

const topic = 'my-topic';

const password = 'JWT TOKEN HERE';

const client = new MqttClient({ hostname, port, protocol, maxMessagesPerSecond });

// called on every low-level mqtt incoming message, let's just listen for disconnect messages
client.onMqttMessage = message => {
    if (message.type === DISCONNECT) {
        console.log('disconnect', message.reason);
    }
};

// called when you receive incoming messages from your subscription
client.onReceive = opts => {
    const { topic, payload, contentType } = opts;
    const display = typeof payload === 'string' ? payload : `(${payload.length} bytes)`;
    console.log(`[topic: ${topic}]${contentType ? ` [content-type: ${contentType}]` : ''} ${display}`);
};

console.log('connecting');
await client.connect({ password });
const { clientId, keepAlive } = client;
console.log('connected', { clientId, keepAlive });

console.log('subscribing');
await client.subscribe({ topicFilter: topic });

console.log('waiting for messages');

// prevent program from terminating until the connection is closed
await client.completion();

console.log('completed');
```
