import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
import { AwsCallContext, computeBucketUrl, R2, s3Fetch, throwIfUnexpectedContentType, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';

export type CopyObjectOpts = { 
    bucket: string, key: string, origin: string, region: string, urlStyle?: UrlStyle, cacheControl?: string, contentDisposition?: string, contentEncoding?: string, contentLanguage?: string, expires?: string, contentType?: string, customMetadata?: Record<string, string>,
    sourceBucket: string, sourceKey: string, ifMatch?: string, ifModifiedSince?: string, ifNoneMatch?: string, ifUnmodifiedSince?: string,
};

export async function copyObject(opts: CopyObjectOpts, context: AwsCallContext): Promise<CopyObjectResult> {
    const { bucket, key, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentType, customMetadata, sourceBucket, sourceKey, ifMatch, ifModifiedSince, ifNoneMatch, ifUnmodifiedSince, urlStyle } = opts;
    const method = 'PUT';
    const url = computeBucketUrl({ origin, bucket, key, urlStyle });
    const headers = new Headers();
    if (typeof cacheControl === 'string') headers.set('cache-control', cacheControl);
    if (typeof contentDisposition === 'string') headers.set('content-disposition', contentDisposition);
    if (typeof contentEncoding === 'string') headers.set('content-encoding', contentEncoding);
    if (typeof contentLanguage === 'string') headers.set('content-language', contentLanguage);
    if (typeof expires === 'string') headers.set('expires', expires);
    if (typeof contentType === 'string') headers.set('content-type', contentType);
    for (const [ name, value ] of Object.entries(customMetadata || {})) {
        headers.set(`x-amz-meta-${name}`, value);
    }

    const sourceUrl = new URL(`https://ignored/${sourceBucket}/${sourceKey}`);
    const source = sourceUrl.toString().substring('https://ignored'.length);

    headers.set('x-amz-copy-source', source);
    if (typeof ifMatch === 'string') headers.set('x-amz-copy-source-if-match', ifMatch);
    if (typeof ifModifiedSince === 'string') headers.set('x-amz-copy-source-if-modified-since', ifModifiedSince);
    if (typeof ifNoneMatch === 'string') headers.set('x-amz-copy-source-if-none-match', ifNoneMatch);
    if (typeof ifUnmodifiedSince === 'string') headers.set('x-amz-copy-source-if-unmodified-since', ifUnmodifiedSince);
    
    const res = await s3Fetch({ method, url, headers, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'application/xml', txt);

    const xml = parseXml(txt);
    return parseCopyObjectResultXml(xml);
}

export interface CopyObjectResult {
    readonly etag: string;
    readonly lastModified: string;
    readonly checksumCrc32?: string;
    readonly checksumCrc32C?: string;
    readonly checksumSha1?: string;
    readonly checksumSha256?: string;
}

//

function parseCopyObjectResultXml(xml: ExtendedXmlNode): CopyObjectResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseCopyObjectResult(doc.getKnownElement('CopyObjectResult'));
    doc.check();
    return rt;
}

function parseCopyObjectResult(element: KnownElement): CopyObjectResult {
    const etag = element.getElementText('ETag');
    const lastModified = element.getElementText('LastModified');
    const checksumCrc32 = element.getOptionalElementText('ChecksumCRC32');
    const checksumCrc32C = element.getOptionalElementText('ChecksumCRC32C');
    const checksumSha1 = element.getOptionalElementText('ChecksumSHA1');
    const checksumSha256 = element.getOptionalElementText('ChecksumSHA256>');
    element.check();
    return { etag, lastModified, checksumCrc32, checksumCrc32C, checksumSha1, checksumSha256 };
}
