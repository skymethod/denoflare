import { MqttClient, DISCONNECT, PUBLISH } from 'https://cdn.jsdelivr.net/gh/skymethod/denoflare@b082a9d039716765437aee28a55b64ab297e1c7b/npm/denoflare-mqtt/esm/main.js'; // served with the correct mime type for browsers

let client;

const decoder = new TextDecoder();
const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' });

globalThis.addEventListener('DOMContentLoaded', (_event) => {
    const [ connectionForm, brokerInput, topicInput, passwordInput, connectButton, connectStatusSpan, compositionForm, messageInput, sendButton, messagesOutput, welcomeElement ] = 
        [ 'connection', 'broker', 'topic', 'password', 'connect', 'connect-status', 'composition', 'message', 'send', 'messages', 'welcome' ].map(v => document.getElementById(v));

    let connected = false;
    let connectStatus = '';
    let sending = false;

    const updateConnectStatus = () => {
        connectStatusSpan.textContent = connected ? 'connected' : connectStatus;
    };

    const updateConnectButton = () => {
        const enable = connected || [ brokerInput, topicInput, passwordInput ].map(v => v.value).every(v => v !== '');
        connectButton.disabled = !enable;
        connectButton.textContent = connected ? 'Disconnect' : 'Connect';
    };

    const updateConnectionInputs = () => {
        const enable = !connected;
        [ brokerInput, topicInput, passwordInput ].forEach(input => {
            input.disabled = !enable;
        });
    };

    [ brokerInput, topicInput, passwordInput ].forEach(input => {
        bindInputToLocalStorage(input);
        input.addEventListener('input', updateConnectButton);
    });

    const setVisible = (element, visible) => element.style.visibility = visible ? 'visible' : 'hidden';
    const setDisplay = (element, displayed) => element.style.display = displayed ? 'block' : 'none';

    const updateCompositionForm = () => {
        setVisible(compositionForm, connected);
    };

    const updateMessageInput = () => {
        const enable = connected;
        messageInput.disabled = !enable;
    };
    updateMessageInput();

    const updateSendButton = () => {
        const enable = connected && messageInput.value !== '';
        sendButton.disabled = !enable;
    };
    updateSendButton();

    messageInput.addEventListener('input', updateSendButton);

    const updateWelcomeAndOutput = () => {
        setDisplay(welcomeElement, !connected);
        setDisplay(messagesOutput, connected);
    };

    const onConnectedChanged = () => {
        updateConnectStatus();
        updateConnectButton();
        updateConnectionInputs();
        updateMessageInput();
        updateSendButton();
        updateCompositionForm();
        updateWelcomeAndOutput();
    };

    connectionForm.addEventListener('submit', async e => {
        e.preventDefault();

        if (connected) {
            console.log('disconnecting');
            connectStatus = 'disconnecting...';
            updateConnectStatus();
            await client.disconnect();
            connected = false;
            connectStatus = '';
            onConnectedChanged();
            return;
        }

        client = new MqttClient({ hostname: `${brokerInput.value}.cloudflarepubsub.com`, port: 8884, protocol: 'wss', maxMessagesPerSecond: 10 }); 
        client.onMqttMessage = message => {
            console.log(JSON.stringify(message, undefined, 2));

            if (message.type === DISCONNECT) {
                connectStatus = message.reason.description;
                console.log({ connectStatus});
                connected = false; 
                onConnectedChanged();
            } else if (message.type === PUBLISH) {
                const messageDisplay = message.payloadFormatIndicator === 1 ? decoder.decode(message.payload) : `${message.payload.length} bytes`;
                const line = `${timeFormat.format(new Date())}: ${messageDisplay}`;
                const messageDiv = document.createElement('div');
                messageDiv.appendChild(document.createTextNode(line));
                messagesOutput.appendChild(messageDiv);
                messageDiv.scrollIntoView({ behavior: 'smooth' });
            }
        };
    
        console.log('connecting');
        connectStatus = 'connecting...';
        updateConnectStatus();
        const password = passwordInput.value;
        try {
            await client.connect({ password, keepAlive: 20 });
        } catch (e) {
            console.warn('error in client.connect', e);
            connectStatus = computeStatusFromError(e);
            updateConnectStatus();
            return;
        }
        try {
            console.log('subscribing');
            connectStatus = 'subscribing...';
            await client.subscribe({ topicFilter: topicInput.value });
        } catch (e) {
            console.warn('error in client.subscribe', e);
            connectStatus = computeStatusFromError(e);
            updateConnectStatus();
            await client.disconnect();
            connected = false;
            onConnectedChanged();
            return;
        }
        console.log('connected');
        connected = true;
        onConnectedChanged();
        messageInput.focus();
        
    });

    compositionForm.addEventListener('submit', async e => {
        e.preventDefault();
        if (sending) return;

        sending = true;
        console.log(`sending: ${messageInput.value}`);
        try {
            await client.publish( { topic: topicInput.value, payload: messageInput.value });
        } finally {
            sending = false;
        }
    });

});

function bindInputToLocalStorage(input) {
    const { id } = input;
    const initialValue = localStorage.getItem(id);
    if (typeof initialValue === 'string') input.value = initialValue;
    input.addEventListener('input', () => localStorage.setItem(id, input.value));
}

function computeStatusFromError(e) {
    if (typeof e === 'string' && e.startsWith('{"code"')) {
        try {
            const { description } = JSON.parse(e);
            if (typeof description === 'string') return description;
        } catch { /* noop */ }
    }
    if (typeof e === 'string') return e;
    return 'failed';
}
