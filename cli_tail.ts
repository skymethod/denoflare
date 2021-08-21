import { createTail } from './cloudflare_api.ts';
import { loadConfig, resolveCredential } from './config_loader.ts';
import { isTailMessageCronEvent, parseTailMessage } from './tail.ts';

export async function tail(scriptName: string) {
    const config = await loadConfig();
    const { accountId, apiToken } = await resolveCredential(config);
    
    const tail = await createTail(accountId, scriptName, apiToken);

    return new Promise((resolve, _reject) => {
        const ws = new WebSocket(tail.url, 'trace-v1'); // else 406 Not Acceptable
        ws.addEventListener('open', event => {
            const timeStamp = new Date(event.timeStamp).toISOString();
            console.log(` open: ${timeStamp}`);
        });
        ws.addEventListener('message', async event => {
            if (event.data instanceof Blob) {
                const text = await event.data.text();
                const obj = JSON.parse(text); // only seen json object payloads
                try {
                    const tm = parseTailMessage(obj);
                    const time = new Date(tm.eventTimestamp).toISOString();
                    if (isTailMessageCronEvent(tm.event)) {
                        const scheduledTime = new Date(tm.event.scheduledTime).toISOString();
                        console.log(` cron: ${time} ${tm.event.cron} ${scheduledTime}`);
                    } else {
                        console.log(`  req: ${time} ${tm.event.request.method} ${tm.event.request.url}`);
                        const userAgent = tm.event.request.headers['user-agent'];
                        if (userAgent) {
                            console.log(`                                ${userAgent}`);
                        }
                    }
                    for (const log of tm.logs) {
                        const timestamp = new Date(log.timestamp).toISOString();
                        console.log(`      ${[timestamp, log.level, log.message.join(', ')].join(' ')}`);
                    }
                    for (const exception of tm.exceptions) {
                        const timestamp = new Date(exception.timestamp).toISOString();
                        console.log(`      ${[timestamp, exception.name, exception.message].join(' ')}`);
                    }
                } catch (e) {
                    console.log(obj);
                    console.error('Error parsing tail message', e);
                    ws.close();
                    resolve(undefined);
                }
            } else {
                throw new Error(`Expected event.data to be Blob`, event.data);
            }
        });
        ws.addEventListener('close', event => {
            const { code, reason, wasClean } = event;
            const timeStamp = new Date(event.timeStamp).toISOString();
            console.log('close', `close: ${timeStamp} ${JSON.stringify({ code, reason, wasClean })}`);
            resolve(undefined);
        });
        ws.addEventListener('error', event => {
            const timeStamp = new Date(event.timeStamp).toISOString();
            console.error('error', `error: ${timeStamp} ${event}`);
            resolve(undefined);
        });
    });
}
