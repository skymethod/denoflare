import { Bytes } from '../common/bytes.ts';
import { denoflareCliCommand } from './cli_common.ts';

export const GENERATE_CREDENTIALS_COMMAND = denoflareCliCommand(['r2', 'generate-credentials'], 'Generate private R2-looking credentials for any use')
    ;

export function generateCredentials(args: (string | number)[], options: Record<string, unknown>) {
    if (GENERATE_CREDENTIALS_COMMAND.dumpHelp(args, options)) return;

    GENERATE_CREDENTIALS_COMMAND.parse(args, options);

    const accessKeyId = new Bytes(crypto.getRandomValues(new Uint8Array(16))).hex();
    const secretAccessKey = new Bytes(crypto.getRandomValues(new Uint8Array(32))).hex();
    console.log(JSON.stringify({ accessKeyId, secretAccessKey }, undefined, 2));
}
