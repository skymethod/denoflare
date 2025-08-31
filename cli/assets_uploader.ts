import { Bytes } from '../common/bytes.ts';
import { isStringRecord } from '../common/check.ts';
import { AssetManifest, createAssetsUploadSession, uploadAssets, UploadAssetsRequest } from '../common/cloudflare_api.ts';
import { sortBy, walk, toFileUrl, systemSeparator, relative, computeContentType, extname } from './deps_cli.ts';
import { computeMd5 } from './wasm_crypto.ts';

export function isAssetManifest(obj: unknown): obj is AssetManifest {
    return isStringRecord(obj) && Object.values(obj).every(v => isStringRecord(v) && typeof v.hash === 'string' && v.size === 'number');
}

export async function uploadAssetsFromDirectory({ directory, accountId, apiToken, scriptName, manifest = {} }: { directory: string, accountId: string, apiToken: string, scriptName: string, manifest?: AssetManifest }): Promise<{ completionJwt: string, manifest: AssetManifest, uploadedAssets: number, uploadedBytes: number }> {
    const uploadAllAssetsRequest: UploadAssetsRequest = {};
    const fileEntries = sortBy(await Array.fromAsync(walk(directory)), v => v.path).filter(v => v.isFile);
    let i = 0;
    for (const { path, name } of fileEntries) {
        const filename = toFileUrl(systemSeparator + relative(directory, path)).pathname;
        const contentType = computeContentTypeForExtension(extname(name));
        const bytes = await Deno.readFile(path);
        const size = bytes.length;
        console.log(`compute ${++i} of ${fileEntries.length}: ${relative(directory, path)} ${size} ${contentType}`);
        const bytesObj = new Bytes(bytes);
        const base64 = bytesObj.base64();
        const hash = (await computeMd5(bytesObj)).hex();
        manifest[filename] = { hash, size };
        
        uploadAllAssetsRequest[hash] = { base64, contentType };
    }
    console.log('Creating assets upload session...');
    const res = await createAssetsUploadSession({ accountId, apiToken, scriptName, request: { manifest } });
    if (!res) throw new Error(`Failed to create new assets upload session`);
    if (!res.jwt) throw new Error(`No assets upload JWT returned`);
    let completionJwt = res.jwt;
    const uploadJwt = res.jwt;
    let uploadedAssets = 0;
    let uploadedBytes = 0;
    const numberFormat = new Intl.NumberFormat(`en-US`);
    if (res.buckets && res.buckets.length > 0) {
        let i = 0;
        for (const hashes of res.buckets) {
            const uploadAssetsRequest = Object.fromEntries(Object.entries(uploadAllAssetsRequest).filter(v => hashes.includes(v[0])));
            const bytes = hashes.map(v => Object.values(manifest).find(w => w.hash === v)!.size).reduce((prev, cur) => prev + cur, 0);
            console.log(`upload ${++i} of ${res.buckets.length}: ${hashes.length} asset${res.buckets.length === 1 ? '' : 's'} (${numberFormat.format(bytes)} bytes)`);
            const result = await uploadAssets({ accountId, apiToken: uploadJwt, scriptName, request: uploadAssetsRequest });
            uploadedAssets += hashes.length;
            uploadedBytes += bytes;
            if (result.jwt) completionJwt = result.jwt;
        }
    }
    console.log(uploadedAssets === 0 ? `No assets uploaded` : `Uploaded ${numberFormat.format(uploadedAssets)} asset${uploadedAssets === 1 ? '' : 's'} (${numberFormat.format(uploadedBytes)} bytes)`);
    return { completionJwt, manifest, uploadedAssets, uploadedBytes };
}

//

const KNOWN_EXT: Record<string, string> = {
    parquet: 'application/vnd.apache.parquet',
}

function computeContentTypeForExtension(extname: string): string | undefined {
    return computeContentType(extname) ?? KNOWN_EXT[extname.startsWith('.') ? extname.substring(1) : extname];
}
