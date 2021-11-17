import { Profile } from '../common/config.ts';
import { CLI_VERSION } from './cli_version.ts';
import { loadConfig, resolveProfile } from './config_loader.ts';
import { GraphqlQuery } from './analytics/graphql.ts';

export async function analytics(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    const firstArg = args[0];
    if (options.help || typeof firstArg !== 'string' ) {
        dumpHelp();
        return;
    }
    if (firstArg === 'do' || firstArg === 'durable-objects') {
        const config = await loadConfig(options);
        const profile = await resolveProfile(config, options);
        await dumpDurableObjects(profile);
    } else {
        dumpHelp();
    }
}

//

function dumpHelp() {
    const lines = [
        `denoflare-analytics ${CLI_VERSION}`,
        'Dump stats via the Cloudflare GraphQL Analytics API',
        '',
        'USAGE:',
        '    denoflare analytics [FLAGS] [OPTIONS] [--]',
        '',
        'FLAGS:',
        '    -h, --help        Prints help information',
        '        --verbose     Toggle verbose output (when applicable)',
        '        --watch       Re-upload the worker script when local changes are detected',
        '',
        'OPTIONS:',
        '        --profile <name>     Name of profile to load from config (default: only profile or default profile in config)',
        '        --config <path>      Path to config file (default: .denoflare in cwd or parents)',
        '',
        'ARGS:',
    ];
    for (const line of lines) {
        console.log(line);
    }
}

async function dumpDurableObjects(profile: Profile) {
    const { accountId, apiToken } = profile;

    const debug = false;
    const query = GraphqlQuery.create()
        .scalar('cost')
        .object('viewer')
            .scalar('budget')
            .object('accounts').argObject('filter', 'accountTag', accountId)
            .scalar('accountTag')
            .object('durableObjectsStorageGroups')
                .argLong('limit', 10000)
                .argRaw('filter', `{date_geq: $start, date_leq: $end}`)
                .argRaw('orderBy', `[date_ASC]`)
                .object('dimensions')
                    .scalar('date')
                    .end()
                .object('max')
                    .scalar('storedBytes')
                    .end()
        .top().toString();

    if (debug) console.log(query);

    const end = utcCurrentDate();
    const start = addDaysToDate(end, -7);
    const reqObj = { query, variables: { start, end } };

    const body = JSON.stringify(reqObj);
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Bearer ${apiToken}` }, body });
    if (res.status !== 200) throw new Error(`Bad res.status: ${res.status}, expected 200, text=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== 'application/json') throw new Error(`Bad res.contentType: ${contentType}, expected application/json, found ${contentType}, text=${await res.text()}`);
    const resObj = await res.json();
    
    if (debug) console.log(JSON.stringify(resObj, undefined, 2));

    const qqlResponse = resObj as GqlResponse;
    for (const account of qqlResponse.data.viewer.accounts) {
        for (const group of account.durableObjectsStorageGroups) {
            const gb = group.max.storedBytes / 1024 / 1024 / 1024;
            const cost = gb * .20;
            console.log(`${group.dimensions.date}\t${Math.round(gb * 100) / 100}gb\t$${Math.round(cost * 100) / 100}/mo`);
        }
    }
    console.log(`cost: ${qqlResponse.data.cost}, budget: ${qqlResponse.data.viewer.budget} (${Math.round(qqlResponse.data.viewer.budget / qqlResponse.data.cost)} left of those)`);
}

function utcCurrentDate(): string {
    return new Date().toISOString().substring(0, 10);
}

function addDaysToDate(date: string, days: number) {
    const d = new Date(`${date}T00:00:00Z`);
    return new Date(
        d.getFullYear(), 
        d.getMonth(), 
        d.getDate() + days,
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
        d.getMilliseconds()
    ).toISOString().substring(0, 10);
}

//

interface GqlResponse {
    data: {
        cost: number,
        viewer: {
            budget: number,
            accounts: {
                accountTag: string,
                durableObjectsStorageGroups: {
                    dimensions: {
                        date: string,
                    },
                    max: {
                        storedBytes: number,
                    },
                }[],
            }[],
        },
    },
}
