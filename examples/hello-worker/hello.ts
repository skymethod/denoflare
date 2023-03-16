import { IncomingRequestCf } from './deps.ts';

// simplest possible module worker, echo back the Cloudflare colo code serving the request
export default {

    fetch(request: IncomingRequestCf): Response {
        const html = `<h3>Hello from ${request.cf.colo}!</h3>`;
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

};
