import { importText } from './deps.ts';
const mqttDemoHtml = await importText(import.meta.url, './static/mqtt-demo.html');
const mqttDemoJs = await importText(import.meta.url, './static/mqtt-demo.js');

export default {

    fetch(request: Request): Response {
        const { method } = request;
        if (method !== 'GET') return new Response(`method not allowed: ${method}`, { status: 405 });

        const { pathname } = new URL(request.url);
        if (pathname === '/') return new Response(mqttDemoHtml, { headers: { 'content-type': 'text/html; charset=utf-8' } });
        if (pathname === '/mqtt-demo.js') return new Response(mqttDemoJs, { headers: { 'content-type': 'text/javascript; charset=utf-8' } });
            
        return new Response('not found', { status: 404 });
    }

};
