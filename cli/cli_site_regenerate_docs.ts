import { denoflareCliCommand } from './cli_common.ts';
import { join } from './deps_cli.ts';
import { directoryExists } from './fs_util.ts';
import { DENOFLARE_COMMAND } from './cli.ts';
import { SERVE_COMMAND } from './cli_serve.ts';
import { PUSH_COMMAND } from './cli_push.ts';
import { TAIL_COMMAND } from './cli_tail.ts';
import { SITE_COMMAND } from './cli_site.ts';
import { SITE_GENERATE_COMMAND } from './cli_site_generate.ts';
import { SITE_SERVE_COMMAND } from './cli_site_serve.ts';
import { ANALYTICS_COMMAND } from './cli_analytics.ts';
import { ANALYTICS_DURABLE_OBJECTS_COMMAND } from './cli_analytics_durable_objects.ts';
import { ANALYTICS_R2_COMMAND } from './cli_analytics_r2.ts';
import { CFAPI_COMMAND } from './cli_cfapi.ts';
import { R2_COMMAND } from './cli_r2.ts';
import { LIST_BUCKETS_COMMAND } from './cli_r2_list_buckets.ts';
import { HEAD_BUCKET_COMMAND } from './cli_r2_head_bucket.ts';
import { CREATE_BUCKET_COMMAND } from './cli_r2_create_bucket.ts';
import { DELETE_BUCKET_COMMAND } from './cli_r2_delete_bucket.ts';
import { GET_BUCKET_ENCRYPTION_COMMAND } from './cli_r2_get_bucket_encryption.ts';
import { DELETE_BUCKET_ENCRYPTION_COMMAND } from './cli_r2_delete_bucket_encryption.ts';
import { PUT_BUCKET_ENCRYPTION_COMMAND } from './cli_r2_put_bucket_encryption.ts';
import { GET_BUCKET_LOCATION_COMMAND } from './cli_r2_get_bucket_location.ts';
import { LIST_OBJECTS_COMMAND } from './cli_r2_list_objects.ts';
import { LIST_OBJECTS_V1_COMMAND } from './cli_r2_list_objects_v1.ts';
import { GET_OBJECT_COMMAND, HEAD_OBJECT_COMMAND } from './cli_r2_get_head_object.ts';
import { PUT_OBJECT_COMMAND } from './cli_r2_put_object.ts';
import { DELETE_OBJECT_COMMAND } from './cli_r2_delete_object.ts';
import { DELETE_OBJECTS_COMMAND } from './cli_r2_delete_objects.ts';
import { COPY_OBJECT_COMMAND } from './cli_r2_copy_object.ts';
import { CREATE_MULTIPART_UPLOAD_COMMAND } from './cli_r2_create_multipart_upload.ts';
import { ABORT_MULTIPART_UPLOAD_COMMAND } from './cli_r2_abort_multipart_upload.ts';
import { COMPLETE_MULTIPART_UPLOAD_COMMAND } from './cli_r2_complete_multipart_upload.ts';
import { UPLOAD_PART_COMMAND } from './cli_r2_upload_part.ts';
import { UPLOAD_PART_COPY_COMMAND } from './cli_r2_upload_part_copy.ts';
import { GENERATE_CREDENTIALS_COMMAND } from './cli_r2_generate_credentials.ts';
import { CliCommand } from './cli_command.ts';

export const SITE_REGENERATE_DOCS_COMMAND = denoflareCliCommand(['site', 'regenerate-docs'], '')
    .arg('docsRepoDir', 'string', '')
    ;

export async function regenerateDocs(args: (string | number)[], options: Record<string, unknown>) {
    if (SITE_REGENERATE_DOCS_COMMAND.dumpHelp(args, options)) return;

    const { docsRepoDir } = SITE_REGENERATE_DOCS_COMMAND.parse(args, options);
    
    if (!await directoryExists(docsRepoDir)) throw new Error(`Bad docsRepoDir: ${docsRepoDir}, must exist`);

    let madeChanges = false;
    const replace = async (path: string, command: CliCommand<unknown>) => {
        const absPath = join(docsRepoDir, path);
        const oldContents = await Deno.readTextFile(absPath);
        const helpContents = command.computeHelp({ includeDocsLinks: true });
        const newContents = oldContents.replace(new RegExp('\n' + command.command.join('-') + '.*?```', 's'), '\n' + helpContents + '\n```');
        if (newContents !== oldContents) {
            console.log(`CHANGED: ${path} ${command.getDocsLink()}`);
            await Deno.writeTextFile(absPath, newContents);
            madeChanges = true;
        }
    };
    await replace('./cli/index.md', DENOFLARE_COMMAND);
    await replace('./cli/serve.md', SERVE_COMMAND);
    await replace('./cli/push.md', PUSH_COMMAND);
    await replace('./cli/tail.md', TAIL_COMMAND);
    await replace('./cli/site/index.md', SITE_COMMAND);
    await replace('./cli/site/generate.md', SITE_GENERATE_COMMAND);
    await replace('./cli/site/serve.md', SITE_SERVE_COMMAND);
    await replace('./cli/analytics/index.md', ANALYTICS_COMMAND);
    await replace('./cli/analytics/durable-objects.md', ANALYTICS_DURABLE_OBJECTS_COMMAND);
    await replace('./cli/analytics/r2.md', ANALYTICS_R2_COMMAND);
    await replace('./cli/cfapi.md', CFAPI_COMMAND);
    for (const r2Command of [
        R2_COMMAND, 

        LIST_BUCKETS_COMMAND,
        HEAD_BUCKET_COMMAND,
        CREATE_BUCKET_COMMAND,
        DELETE_BUCKET_COMMAND,
        GET_BUCKET_ENCRYPTION_COMMAND,
        DELETE_BUCKET_ENCRYPTION_COMMAND,
        PUT_BUCKET_ENCRYPTION_COMMAND,
        GET_BUCKET_LOCATION_COMMAND,

        LIST_OBJECTS_COMMAND,
        LIST_OBJECTS_V1_COMMAND,
        GET_OBJECT_COMMAND,
        HEAD_OBJECT_COMMAND,
        PUT_OBJECT_COMMAND,
        DELETE_OBJECT_COMMAND,
        DELETE_OBJECTS_COMMAND,
        COPY_OBJECT_COMMAND,

        CREATE_MULTIPART_UPLOAD_COMMAND,
        ABORT_MULTIPART_UPLOAD_COMMAND,
        COMPLETE_MULTIPART_UPLOAD_COMMAND,
        UPLOAD_PART_COMMAND,
        UPLOAD_PART_COPY_COMMAND,
        
        GENERATE_CREDENTIALS_COMMAND,
        
    ]) {
        await replace('./cli/r2.md', r2Command);
    }

    if (!madeChanges) console.log('no changes');
}
