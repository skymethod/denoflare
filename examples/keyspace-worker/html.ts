import { Env } from './env.ts';

export function computeHtml({ service, colo, coloCounts, attempts, times, env, admin, searchParams }: { service: string, colo: string, coloCounts: Record<string,Record<string,number>>, attempts: number, times: Record<string, number>, env: Env, admin: boolean, searchParams: URLSearchParams }): string {
    const origin = service === 'deno' ? env.denoOrigin : env.cloudflareOrigin;
    const cfAnalyticsToken = service === 'deno' ? env.denoCfAnalyticsToken : env.cloudflareCfAnalyticsToken;
    const title = 'keyspace: deno vs cloudflare pointing to deno kv';
    const header = new URL(origin!).hostname;
    const otherService = computeOtherService(service);
    const otherServiceOrigin = service === 'deno' ? env.cloudflareOrigin : env.denoOrigin;
    const millis = total(times);
   
    const counts = admin && searchParams.has('fake') ? generateFakeCounts() : coloCounts;
    const tableRows = computeTableRows(counts, service, colo);
    return template({ title, header, origin, cfAnalyticsToken, service, colo, otherService, otherServiceOrigin, millis, tableRows, attempts });
}

//

function generateFakeCounts(): Record<string, Record<string, number>> {
    const rt: Record<string, Record<string, number>> = {};
    for (const service of [ 'deno', 'cloudflare' ]) {
        const coloCounts: Record<string, number> = {};
        rt[service] = coloCounts;
        for (let i = 0; i < (service === 'deno' ? 30 : 40); i++) {
            const uuid = crypto.randomUUID();
            const tokens = uuid.split('-');
            const colo = tokens.slice(0, 2).join('-');
            const count = parseInt(tokens.at(-1)!.slice(0, 4), 16);
            coloCounts[colo] = count;
        }
    
    }
    return rt;
}

function total(record: Record<string, number>): number {
    return Object.values(record).reduce((a, b) => a + b, 0);
}

const computeOtherService = (service: string) => service === 'deno' ? 'cloudflare' : 'deno';

const numberFormat = new Intl.NumberFormat(`en-US`);

function computeTableColumn(service: string, coloCounts: Record<string,Record<string,number>>, yourService: string, yourColo: string) {
    return [ 
        `<div class="col-span-2 justify-self-center">${service}</div>`,
        `<div class="col-span-2 justify-self-center mb-8">${numberFormat.format(total(coloCounts[service]))}</div>`,
        ...Object.entries(coloCounts[service]).sort((lhs, rhs) => rhs[1] - lhs[1]).map(([ colo, count ]) => `<div class="justify-self-end pr-4">${numberFormat.format(count)}</div><div>${colo}${yourService === service && yourColo === colo ? ' (you)' : ''}</div>`),
    ];
}

function computeTableRows(coloCounts: Record<string,Record<string,number>>, yourService: string, yourColo: string) {
    const winner = total(coloCounts.deno) > total(coloCounts.cloudflare) ? 'deno' : 'cloudflare';
    const loser = winner === 'deno' ? 'cloudflare' : 'deno';
    const winnerCol = computeTableColumn(winner, coloCounts, yourService, yourColo);
    const loserCol = computeTableColumn(loser, coloCounts, yourService, yourColo);

    const lines: string[] = [];
    const empty = `<div></div><div></div>`;
    for (let i = 0; i < Math.max(winnerCol.length, loserCol.length); i++) {
        lines.push(`${winnerCol[i] ?? empty}${loserCol[i] ?? empty}`);
    }

    return lines.map(v => `        ${v}`).join('\n');
}

const anchorStyle = 'text-rose-600 hover:underline hover:underline-offset-4';

// deno-lint-ignore no-explicit-any
const template = ({ title, origin, header, cfAnalyticsToken, service, colo, otherService, otherServiceOrigin, millis, tableRows, attempts }: Record<string, any>) => `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="canonical" href="${origin}/" />
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-cyan-950 text-neutral-300">
    <div class="md:container px-4 md:mx-auto">
        <h1 class="text-2xl my-4">${header}</h1>
        Your IP address just voted for <span class="font-bold">${service}</span> from ${colo} in ${numberFormat.format(millis)}ms${attempts > 1 ? ` in ${attempts} attempts` : ''}. Switch your vote by visiting the <a class="${anchorStyle}" href="${otherServiceOrigin}/">${otherService}-hosted version</a> of this site.
        <ul class="list-disc list-inside mt-4">
            <li>Both sites run the same <a class="${anchorStyle}" href="https://github.com/skymethod/denoflare/blob/master/examples/keyspace-worker/worker.ts">worker code</a></li>
            <li>Both sites point to the same backend <a class="${anchorStyle}" href="https://deno.com/kv">Deno KV</a> database hosted on <a class="${anchorStyle}" href="https://deno.com/deploy">Deno Deploy</a></li>
            <li>The cloudflare-hosted version uses the new <a class="${anchorStyle}" href="https://github.com/skymethod/kv-connect-kit">kv-connect-kit</a> library to access Deno KV remotely over <a class="${anchorStyle}" href="https://github.com/denoland/deno/tree/main/ext/kv#kv-connect">KV Connect</a></li>
            <li>Made by <a class="${anchorStyle}" href="https://twitter.com/johnspurlock">John Spurlock</a> using <a class="${anchorStyle}" href="https://denoflare.dev/">Denoflare</a></li>
        </ul>
        <div class="grid grid-cols-[max-content_1fr_max-content_1fr] max-w-md mx-auto mt-8">
${tableRows}
        <div>
    </div>
    <!-- Cloudflare Web Analytics --><script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script><!-- End Cloudflare Web Analytics -->
</body>
</html>`
