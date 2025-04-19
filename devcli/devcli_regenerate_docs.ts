import { join } from './deps.ts';
import { directoryExists } from '../cli/fs_util.ts';
import { DENOFLARE_COMMAND } from '../cli/cli.ts';
import { SERVE_COMMAND } from '../cli/cli_serve.ts';
import { PUSH_COMMAND } from '../cli/cli_push.ts';
import { PUSH_DEPLOY_COMMAND } from '../cli/cli_push_deploy.ts';
import { PUSH_LAMBDA_COMMAND } from '../cli/cli_push_lambda.ts';
import { PUSH_SUPABASE_COMMAND } from '../cli/cli_push_supabase.ts';
import { TAIL_COMMAND } from '../cli/cli_tail.ts';
import { SITE_COMMAND } from '../cli/cli_site.ts';
import { SITE_GENERATE_COMMAND } from '../cli/cli_site_generate.ts';
import { SITE_SERVE_COMMAND } from '../cli/cli_site_serve.ts';
import { ANALYTICS_COMMAND } from '../cli/cli_analytics.ts';
import { ANALYTICS_DURABLE_OBJECTS_COMMAND } from '../cli/cli_analytics_durable_objects.ts';
import { ANALYTICS_R2_COMMAND } from '../cli/cli_analytics_r2.ts';
import { CFAPI_COMMAND } from '../cli/cli_cfapi.ts';
import { AE_PROXY_COMMAND } from '../cli/cli_ae_proxy.ts';
import { R2_COMMAND } from '../cli/cli_r2.ts';
import { LIST_BUCKETS_COMMAND } from '../cli/cli_r2_list_buckets.ts';
import { HEAD_BUCKET_COMMAND } from '../cli/cli_r2_head_bucket.ts';
import { CREATE_BUCKET_COMMAND } from '../cli/cli_r2_create_bucket.ts';
import { DELETE_BUCKET_COMMAND } from '../cli/cli_r2_delete_bucket.ts';
import { GET_BUCKET_ENCRYPTION_COMMAND } from '../cli/cli_r2_get_bucket_encryption.ts';
import { DELETE_BUCKET_ENCRYPTION_COMMAND } from '../cli/cli_r2_delete_bucket_encryption.ts';
import { PUT_BUCKET_ENCRYPTION_COMMAND } from '../cli/cli_r2_put_bucket_encryption.ts';
import { GET_BUCKET_LOCATION_COMMAND } from '../cli/cli_r2_get_bucket_location.ts';
import { LIST_OBJECTS_COMMAND } from '../cli/cli_r2_list_objects.ts';
import { LIST_OBJECTS_V1_COMMAND } from '../cli/cli_r2_list_objects_v1.ts';
import { GET_OBJECT_COMMAND, HEAD_OBJECT_COMMAND } from '../cli/cli_r2_get_head_object.ts';
import { PUT_OBJECT_COMMAND } from '../cli/cli_r2_put_object.ts';
import { DELETE_OBJECT_COMMAND } from '../cli/cli_r2_delete_object.ts';
import { DELETE_OBJECTS_COMMAND } from '../cli/cli_r2_delete_objects.ts';
import { COPY_OBJECT_COMMAND } from '../cli/cli_r2_copy_object.ts';
import { CREATE_MULTIPART_UPLOAD_COMMAND } from '../cli/cli_r2_create_multipart_upload.ts';
import { ABORT_MULTIPART_UPLOAD_COMMAND } from '../cli/cli_r2_abort_multipart_upload.ts';
import { COMPLETE_MULTIPART_UPLOAD_COMMAND } from '../cli/cli_r2_complete_multipart_upload.ts';
import { UPLOAD_PART_COMMAND } from '../cli/cli_r2_upload_part.ts';
import { UPLOAD_PART_COPY_COMMAND } from '../cli/cli_r2_upload_part_copy.ts';
import { GENERATE_CREDENTIALS_COMMAND } from '../cli/cli_r2_generate_credentials.ts';
import { CliCommand } from '../cli/cli_command.ts';
import { PRESIGN_COMMAND } from '../cli/cli_r2_presign.ts';
import { JWT_COMMAND, PUBSUB_COMMAND } from '../cli/cli_pubsub.ts';
import { PUBLISH_COMMAND } from '../cli/cli_pubsub_publish.ts';
import { SUBSCRIBE_COMMAND } from '../cli/cli_pubsub_subscribe.ts';
import { CREATE_COMMAND, D1_COMMAND, DROP_COMMAND, LIST_COMMAND, GET_COMMAND, QUERY_COMMAND, CLEAR_COMMAND, EXPORT_COMMAND, EXPORT_SQL_COMMAND, EXPORT_DB_COMMAND, IMPORT_COMMAND, IMPORT_TSV_COMMAND, TIME_TRAVEL_BOOKMARK_COMMAND, TIME_TRAVEL_RESTORE_COMMAND } from '../cli/cli_d1.ts';
import { LIST_MULTIPART_UPLOADS_COMMAND } from '../cli/cli_r2_list_multipart_uploads.ts';

export const REGENERATE_DOCS_COMMAND = CliCommand.of(['denoflaredev', 'regenerate-docs'])
    .arg('docsRepoDir', 'string', '')
    ;

export async function regenerateDocs(args: (string | number)[], options: Record<string, unknown>) {
    if (REGENERATE_DOCS_COMMAND.dumpHelp(args, options)) return;

    const { docsRepoDir } = REGENERATE_DOCS_COMMAND.parse(args, options);
    
    if (!await directoryExists(docsRepoDir)) throw new Error(`Bad docsRepoDir: ${docsRepoDir}, must exist`);

    let madeChanges = false;
    const replace = async (path: string, cliCommand: CliCommand<unknown>) => {
        const absPath = join(docsRepoDir, path);
        const oldContents = await Deno.readTextFile(absPath);
        const helpContents = cliCommand.computeHelp({ includeDocsLinks: true });
        const { command, docsLink, description} = cliCommand.getInfo();
        let newContents = oldContents.replace(new RegExp('\n' + command.join('-') + '.*?```', 's'), '\n' + helpContents + '\n```');
        if (docsLink && !docsLink.includes('#') && description) {
            // top-level doc, except root
            newContents = newContents.replace(/\nsummary:\s+.*?\n/, `\nsummary: ${description}\n`);
        }
        if (newContents !== oldContents) {
            console.log(`CHANGED: ${path} ${docsLink ?? ''}`);
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
    await replace('./cli/ae-proxy.md', AE_PROXY_COMMAND);
    await replace('./cli/push-deploy.md', PUSH_DEPLOY_COMMAND);
    await replace('./cli/push-lambda.md', PUSH_LAMBDA_COMMAND);
    await replace('./cli/push-supabase.md', PUSH_SUPABASE_COMMAND);
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
        LIST_MULTIPART_UPLOADS_COMMAND,
        
        GENERATE_CREDENTIALS_COMMAND,
        PRESIGN_COMMAND,
        
    ]) {
        await replace('./cli/r2.md', r2Command);
    }

    for (const pubsubCommand of [
        PUBSUB_COMMAND, 

        PUBLISH_COMMAND,
        SUBSCRIBE_COMMAND,
        JWT_COMMAND,
    ]) {
        await replace('./cli/pubsub.md', pubsubCommand);
    }

    for (const d1Command of [
        D1_COMMAND, 

        LIST_COMMAND,
        GET_COMMAND,
        DROP_COMMAND,
        CREATE_COMMAND,
        QUERY_COMMAND,
        CLEAR_COMMAND,

        EXPORT_COMMAND,
        EXPORT_SQL_COMMAND,
        EXPORT_DB_COMMAND,
        IMPORT_COMMAND,
        IMPORT_TSV_COMMAND,

        TIME_TRAVEL_BOOKMARK_COMMAND,
        TIME_TRAVEL_RESTORE_COMMAND,
    ]) {
        await replace('./cli/d1.md', d1Command);
    }

    if (!madeChanges) console.log('no changes');
}
