import { createTail } from './cloudflare_api.ts';
import { loadConfig, resolveCredential } from './config_loader.ts';
import { isTailMessageCronEvent, TailOptions } from './tail.ts';
import { TailConnection, TailConnectionCallbacks } from './tail_connection.ts';

export async function tail(scriptName: string) {
    const config = await loadConfig();
    const { accountId, apiToken } = await resolveCredential(config);
    
    console.log('creating tail...');
    const tail = await createTail(accountId, scriptName, apiToken);

    return new Promise((resolve, _reject) => {
        const callbacks: TailConnectionCallbacks = {
            onOpen: (_cn, timeStamp) => {
                const timeStampStr = new Date(timeStamp).toISOString();
                console.log(` open: ${timeStampStr}`);
            },
            onClose: (_cn, timeStamp, code, reason, wasClean) => {
                const timeStampStr = new Date(timeStamp).toISOString();
                console.log(`close: ${timeStampStr} ${JSON.stringify({ code, reason, wasClean })}`);
                resolve(undefined);
            },
            onError: (_cn, timeStamp, event) => {
                const timeStampStr = new Date(timeStamp).toISOString();
                console.error(`error: ${timeStampStr}`, event);
                resolve(undefined);
            },
            onUnparsedMessage: (cn, _timeStamp, message, parseError) => {
                console.log('Unparsed message', message);
                console.error('Error parsing tail message', parseError);
                cn.close();
                resolve(undefined);
            },
            onTailMessage: (_cn, _timeStamp, message) => {
                const time = new Date(message.eventTimestamp).toISOString();
                if (isTailMessageCronEvent(message.event)) {
                    const scheduledTime = new Date(message.event.scheduledTime).toISOString();
                    console.log(` cron: ${time} ${message.event.cron} ${scheduledTime}`);
                } else {
                    console.log(`  req: ${time} ${message.event.request.method} ${message.event.request.url}`);
                    const userAgent = message.event.request.headers['user-agent'];
                    if (userAgent) {
                        console.log(`                                ${userAgent}`);
                    }
                }
                for (const log of message.logs) {
                    const timestamp = new Date(log.timestamp).toISOString();
                    console.log(`      ${[timestamp, log.level, log.message.join(', ')].join(' ')}`);
                }
                for (const exception of message.exceptions) {
                    const timestamp = new Date(exception.timestamp).toISOString();
                    console.log(`      ${[timestamp, exception.name, exception.message].join(' ')}`);
                }
            }
        };
        const options: TailOptions = { filters: [
            // { query: 'bar' } // QueryFilter  text match on console.log messages
        ]};
        const _cn = new TailConnection(tail.url, callbacks).setOptions(options);
    });
}
