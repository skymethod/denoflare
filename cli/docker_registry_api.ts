import { Bytes } from '../common/bytes.ts';
import { isStringRecord } from '../common/check.ts';

export type BlobRef = {
    mediaType: string, // config: application/vnd.oci.image.config.v1+json, layer: application/vnd.oci.image.layer.v1.tar+gzip
    digest: string, // sha256:<64hex>
    size: number,
}

// https://github.com/opencontainers/image-spec/blob/main/manifest.md
export type Manifest = {
    schemaVersion: number, // 2
    mediaType: string, // application/vnd.oci.image.manifest.v1+json
    config: BlobRef,
    layers: BlobRef[],
}

export function isManifest(obj: unknown): obj is Manifest {
    return isStringRecord(obj)
        && typeof obj.schemaVersion === 'number'
        && typeof obj.mediaType === 'string'
        && isStringRecord(obj.config)
        && Array.isArray(obj.layers)
        ;
}

// https://github.com/opencontainers/image-spec/blob/main/image-index.md
export type ImageIndex = {
    schemaVersion: number, // 2
    mediaType: string, // application/vnd.oci.image.index.v1+json
    manifests: BlobRef & { // application/vnd.oci.image.manifest.v1+json
        annotations?: Record<string, string>, // { "vnd.docker.reference.digest": sha256:<64hex>, "vnd.docker.reference.type": "attestation-manifest" }
        platform: {
            architecture: string, // amd64, unknown
            os: string, // linux, unknown
        }
    }[],
}

export async function dockerFetch(url: string, { authorization }: { authorization?: string }): Promise<Manifest | ImageIndex | Record<string, unknown> | Bytes | undefined> {
    const res = await fetch(url, { headers: { ...(authorization && { authorization }), accept: 'application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' } });
    if (res.status === 404) return undefined;
 
    if (!res.ok) throw new Error(`Unexpected status ${res.status} for ${url}`);
    const [ contentType, dockerContentDigest ] = [ 'content-type', 'docker-content-digest' ].map(v => res.headers.get(v));

    if (typeof dockerContentDigest !== 'string') throw new Error(`No docker-content-digest for ${url}`);
    const expectedSha256 = /^sha256:([0-9a-f]{64})$/.exec(dockerContentDigest)?.at(1);
    if (!expectedSha256) throw new Error(`Unexpected docker-content-digest ${dockerContentDigest} for ${url}`);
    const bytes = new Bytes(new Uint8Array(await res.arrayBuffer()));
    const computedSha256 = (await bytes.sha256()).hex();
    if (expectedSha256 !== computedSha256) throw new Error(`Invalid docker-content-digest ${dockerContentDigest} (computed sha256:${computedSha256}) for ${url}`);
    
    if (contentType === 'application/vnd.oci.image.index.v1+json') {
        return JSON.parse(bytes.utf8()) as ImageIndex;
    } else if (contentType === 'application/vnd.oci.image.manifest.v1+json') {
        return JSON.parse(bytes.utf8()) as Manifest;
    } else if (contentType === null) {
        if (bytes.array().at(0) === 0x7b /* { */) return JSON.parse(bytes.utf8()) as Record<string, unknown>;
        return bytes;
    }
    throw new Error();
}
