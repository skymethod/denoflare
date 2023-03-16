import { IncomingRequestCf } from './deps.ts';

// simplest possible module worker, echo back the client's city, as determined by Cloudflare
export default {

    fetch(request: IncomingRequestCf): Response {
       // FIXME: .cf.city is not available
        const html = `<h3>Hello ${request.cf.city}!</h3>`;
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

};
