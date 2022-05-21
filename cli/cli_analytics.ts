import { denoflareCliCommand } from './cli_common.ts';
import { analyticsDurableObjects, ANALYTICS_DURABLE_OBJECTS_COMMAND } from './cli_analytics_durable_objects.ts';
import { analyticsR2, ANALYTICS_R2_COMMAND } from './cli_analytics_r2.ts';

export const ANALYTICS_COMMAND = denoflareCliCommand('analytics', 'Dump stats via the Cloudflare GraphQL Analytics API')
    .subcommand(ANALYTICS_DURABLE_OBJECTS_COMMAND, analyticsDurableObjects)
    .subcommand(ANALYTICS_R2_COMMAND, analyticsR2)
    ;

export async function analytics(args: (string | number)[], options: Record<string, unknown>): Promise<void> {
    await ANALYTICS_COMMAND.routeSubcommand(args, options);
}

export function dumpTable(rows: (string | number)[][], opts: { leftAlignColumns?: number[] } = {}) {
    const { leftAlignColumns = [] } = opts;
    const sizes: number[] = [];
    for (const row of rows) {
        for (let i = 0; i < row.length; i++) {
            const size = `${row[i]}`.length;
            sizes[i] = typeof sizes[i] === 'number' ? Math.max(sizes[i], size) : size;
        }
    }
    for (const row of rows) {
        const pieces = [];
        for (let i = 0; i < row.length; i++) {
            const size = sizes[i];
            const val = `${row[i]}`;
            const piece = leftAlignColumns.includes(i) ? val.padEnd(size, ' ') : val.padStart(size, ' ');
            pieces.push(piece);
        }
        console.log(pieces.join('  '));
    }
}
