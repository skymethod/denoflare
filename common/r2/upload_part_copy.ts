import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
import { AwsCallContext, R2, s3Fetch, throwIfUnexpectedContentType, throwIfUnexpectedStatus } from './r2.ts';

export type UploadPartCopyOpts = { 
    bucket: string, key: string, uploadId: string, partNumber: number, origin: string, region: string,
    sourceBucket: string, sourceKey: string, sourceRange?: string, ifMatch?: string, ifModifiedSince?: string, ifNoneMatch?: string, ifUnmodifiedSince?: string,
};

export async function uploadPartCopy(opts: UploadPartCopyOpts, context: AwsCallContext): Promise<CopyPartResult> {
    const { bucket, key, origin, region, uploadId, partNumber, sourceBucket, sourceKey, sourceRange, ifMatch, ifModifiedSince, ifNoneMatch, ifUnmodifiedSince } = opts;
    const method = 'PUT';
    const url = new URL(`${origin}/${bucket}/${key}`);
    url.searchParams.set('partNumber', String(partNumber));
    url.searchParams.set('uploadId', uploadId);

    const headers = new Headers();

    const sourceUrl = new URL(`https://ignored/${sourceBucket}/${sourceKey}`);
    const source = sourceUrl.toString().substring('https://ignored/'.length); // r2 bug! should include leading slash
    headers.set('x-amz-copy-source', source);
    if (typeof ifMatch === 'string') headers.set('x-amz-copy-source-if-match', ifMatch);
    if (typeof ifModifiedSince === 'string') headers.set('x-amz-copy-source-if-modified-since', ifModifiedSince);
    if (typeof ifNoneMatch === 'string') headers.set('x-amz-copy-source-if-none-match', ifNoneMatch);
    if (typeof ifUnmodifiedSince === 'string') headers.set('x-amz-copy-source-if-unmodified-since', ifUnmodifiedSince);
    if (typeof sourceRange === 'string') headers.set('x-amz-copy-source-range', sourceRange);
    
    const res = await s3Fetch({ method, url, headers, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'text/plain;charset=UTF-8', txt);

    const xml = parseXml(txt);
    return parseCopyPartResultXml(xml);
}

export interface CopyPartResult {
    readonly etag: string;
    readonly lastModified: string;
    readonly checksumCrc32?: string;
    readonly checksumCrc32C?: string;
    readonly checksumSha1?: string;
    readonly checksumSha256?: string;
}

//

function parseCopyPartResultXml(xml: ExtendedXmlNode): CopyPartResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseCopyPartResult(doc.getKnownElement('CopyPartResult'));
    doc.check();
    return rt;
}

function parseCopyPartResult(element: KnownElement): CopyPartResult {
    const etag = element.getElementText('ETag');
    const lastModified = element.getElementText('LastModified');
    const checksumCrc32 = element.getOptionalElementText('ChecksumCRC32');
    const checksumCrc32C = element.getOptionalElementText('ChecksumCRC32C');
    const checksumSha1 = element.getOptionalElementText('ChecksumSHA1');
    const checksumSha256 = element.getOptionalElementText('ChecksumSHA256>');
    element.check();
    return { etag, lastModified, checksumCrc32, checksumCrc32C, checksumSha1, checksumSha256 };
}
