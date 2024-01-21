import { BlobReader, BlobWriter, TextReader, Uint8ArrayReader, ZipReader, ZipWriter } from 'https://deno.land/x/zipjs@v2.7.17/index.js';
import { Bytes } from '../bytes.ts';

export async function createDenoLayerZip({ denoZipStream } : { denoZipStream: ReadableStream<Uint8Array> }): Promise<{ zipBlob: Blob, sha1Hex: string }> {
    return await createZip({ denoZipStream });
}

export async function createRuntimeZip({ denoZipStream, runtimeTs, runtimeTypesTs, workerTs, additionalBlobs } : { denoZipStream: ReadableStream<Uint8Array> | undefined, runtimeTs: string, runtimeTypesTs: string, workerTs: string, additionalBlobs?: Record<string, Uint8Array> }): Promise<{ zipBlob: Blob, sha1Hex: string }> {
    return await createZip({ denoZipStream, runtimeTs, runtimeTypesTs, workerTs, additionalBlobs });
}

//

async function createZip({ denoZipStream, runtimeTs, runtimeTypesTs, workerTs, additionalBlobs } : { denoZipStream?: ReadableStream<Uint8Array>, runtimeTs?: string, runtimeTypesTs?: string, workerTs?: string, additionalBlobs?: Record<string, Uint8Array> }): Promise<{ zipBlob: Blob, sha1Hex: string }> {

    const REGULAR =       0x80000000n; // (1 << 31)
    const OWNER_READ =    0x01000000n; // (1 << 24)
    const OWNER_WRITE =   0x00800000n; // (1 << 23)
    const OWNER_EXECUTE = 0x00400000n; // (1 << 22)
    const GROUP_READ =    0x00200000n; // (1 << 21)
    const _GROUP_WRITE =  0x00100000n; // (1 << 20)
    const GROUP_EXECUTE = 0x00080000n; // (1 << 19)
    const OTHER_READ =    0x00040000n; // (1 << 18)
    const _OTHER_WRITE =  0x00020000n; // (1 << 17)
    const OTHER_EXECUTE = 0x00010000n; // (1 << 16)
    const rwxr_xr_x = Number(REGULAR | OWNER_READ | OWNER_WRITE | OWNER_EXECUTE | GROUP_READ | GROUP_EXECUTE | OTHER_READ | OTHER_EXECUTE);
    const rw_r__r__ = Number(REGULAR | OWNER_READ | OWNER_WRITE | GROUP_READ | OTHER_READ);

    const INTERNAL_TEXT = 0x1;
    const INTERNAL_BINARY = 0x0;

    const zipBlobWriter = new BlobWriter();
    const msDosCompatible = false;
    const version = 20; const versionMadeBy = 798; // magic: found using zipinfo, required to preserve unix permissions
    const lastModDate = new Date(0);
    const zipWriter = new ZipWriter(zipBlobWriter, { lastModDate, msDosCompatible, version, versionMadeBy });
   
    if (denoZipStream) {
        const denoZipReader = new ZipReader(denoZipStream);
        for await (const entry of denoZipReader.getEntriesGenerator({ })) {
            if (entry.filename === 'deno' && entry.getData) {
                const b = await entry.getData(new BlobWriter());
                console.log(`  adding deno`);
                await zipWriter.add(entry.filename, new BlobReader(b), { msDosCompatible, version, versionMadeBy, internalFileAttribute: INTERNAL_BINARY, externalFileAttribute: rwxr_xr_x, lastModDate });
            }
        }
        await denoZipReader.close();
    }

    if (runtimeTs && runtimeTypesTs && workerTs) {
        const denoBinDir = denoZipStream ? `.` : `/opt`; // . = /var/task, /opt = where the layer zips are applied
        const bootstrap = `
#!/bin/sh
mkdir -p /tmp/.deno
cd $LAMBDA_TASK_ROOT
DENO_DIR=/tmp/.deno DENO_RUN_TIME=$(date +%s%N) ${denoBinDir}/deno run -A lambda_runtime.ts
`.trimStart();

        console.log(`  adding bootstrap`);
        await zipWriter.add('bootstrap', new TextReader(bootstrap), { msDosCompatible, version, versionMadeBy, internalFileAttribute: INTERNAL_TEXT, externalFileAttribute: rwxr_xr_x, lastModDate });
        console.log(`  adding lambda_runtime.ts`);
        await zipWriter.add('lambda_runtime.ts', new TextReader(runtimeTs), { msDosCompatible, version, versionMadeBy, internalFileAttribute: INTERNAL_TEXT, externalFileAttribute: rw_r__r__, lastModDate });
        console.log(`  adding lambda_runtime.d.ts`);
        await zipWriter.add('lambda_runtime.d.ts', new TextReader(runtimeTypesTs), { msDosCompatible, version, versionMadeBy, internalFileAttribute: INTERNAL_TEXT, externalFileAttribute: rw_r__r__, lastModDate });
        console.log(`  adding worker.ts`);
        await zipWriter.add('worker.ts', new TextReader(workerTs), { msDosCompatible, version, versionMadeBy, internalFileAttribute: INTERNAL_TEXT, externalFileAttribute: rw_r__r__, lastModDate });

        if (additionalBlobs) {
            for (const [ name, bytes ] of Object.entries(additionalBlobs)) {
                console.log(`  adding ${name}`);
                await zipWriter.add(name, new Uint8ArrayReader(bytes), { msDosCompatible, version, versionMadeBy, internalFileAttribute: INTERNAL_BINARY, externalFileAttribute: rwxr_xr_x, lastModDate });
            }
        }
    }

    await zipWriter.close();
    const zipBlob = await zipBlobWriter.getData();
    const sha1Hex = (await new Bytes(new Uint8Array(await zipBlob.arrayBuffer())).sha1()).hex();
    return { zipBlob, sha1Hex };
}
