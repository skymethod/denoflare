import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
import { AwsCallContext, computeBucketUrl, R2, s3Fetch, S3_XMLNS, throwIfUnexpectedContentType, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';

export type CreateMultipartUploadOpts = { bucket: string, key: string, origin: string, region: string, urlStyle?: UrlStyle, 
    cacheControl?: string, contentDisposition?: string, contentEncoding?: string, contentLanguage?: string, expires?: string, contentType?: string, customMetadata?: Record<string, string>,
    ifMatch?: string, ifNoneMatch?: string, ifModifiedSince?: string, ifUnmodifiedSince?: string
};

export async function createMultipartUpload(opts: CreateMultipartUploadOpts, context: AwsCallContext): Promise<InitiateMultipartUploadResult> {
    const { bucket, key, origin, region, cacheControl, contentDisposition, contentEncoding, contentLanguage, expires, contentType, customMetadata, urlStyle, ifMatch, ifNoneMatch, ifModifiedSince, ifUnmodifiedSince } = opts;
    const method = 'POST';
    const url = computeBucketUrl({ origin, bucket, key, urlStyle, subresource: 'uploads' });
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
    if (typeof ifMatch === 'string') headers.set('if-match', ifMatch);
    if (typeof ifNoneMatch === 'string') headers.set('if-none-match', ifNoneMatch);
    if (typeof ifModifiedSince === 'string') headers.set('if-modified-since', ifModifiedSince);
    if (typeof ifUnmodifiedSince === 'string') headers.set('if-unmodified-since', ifUnmodifiedSince);

    const res = await s3Fetch({ method, url, headers, region, context });
    await throwIfUnexpectedStatus(res, 200);
    
    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'application/xml', txt);

    const xml = parseXml(txt);
    return parseInitiateMultipartUploadResultXml(xml);
}

export interface InitiateMultipartUploadResult {
    readonly bucket: string;
    readonly key: string;
    readonly uploadId: string;
}

//

function parseInitiateMultipartUploadResultXml(xml: ExtendedXmlNode): InitiateMultipartUploadResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseInitiateMultipartUploadResult(doc.getKnownElement('InitiateMultipartUploadResult', { xmlns: S3_XMLNS }));
    doc.check();
    return rt;
}

function parseInitiateMultipartUploadResult(element: KnownElement): InitiateMultipartUploadResult {
    const bucket = element.getElementText('Bucket');
    const key = element.getElementText('Key');
    const uploadId = element.getElementText('UploadId');
    element.check();
    return { bucket, key, uploadId };
}
