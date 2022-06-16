import { MqttClient } from 'https://cdn.jsdelivr.net/gh/skymethod/denoflare@f0a7b9381f23931863819cfeb99e3d43bd5a07bc/npm/denoflare-mqtt/esm/main.js'; // served with the correct mime type for browsers

let client;

globalThis.addEventListener('DOMContentLoaded', (_event) => {
    const [ connectionForm, brokerInput, topicInput, passwordInput, connectButton ] = [ 'connection', 'broker', 'topic', 'password', 'connect' ].map(v => document.getElementById(v));

    const updateConnectButton = () => {
        const enable = [ brokerInput, topicInput, passwordInput ].map(v => v.value).every(v => v !== '');
        connectButton.disabled = !enable;
    };

    [ brokerInput, topicInput, passwordInput ].forEach(input => {
        bindInputToLocalStorage(input);
        input.addEventListener('input', updateConnectButton);
    });

    connectionForm.addEventListener('submit', async e => {
        e.preventDefault();
        console.log('submit!');

        client = new MqttClient({ hostname: `${brokerInput.value}.cloudflarepubsub.com`, port: 8884, protocol: 'wss', maxMessagesPerSecond: 10 }); 
        client.onMqttMessage = message => {
            console.log(JSON.stringify(message, undefined, 2));
        };
    
        console.log('connecting');
        const password = passwordInput.value;
        console.log(password);
        await client.connect({ password, keepAlive: 20 });
        console.log('connected');
    });

});

function bindInputToLocalStorage(input) {
    const { id } = input;
    const initialValue = localStorage.getItem(id);
    if (typeof initialValue === 'string') input.value = initialValue;
    input.addEventListener('input', () => localStorage.setItem(id, input.value));
}
