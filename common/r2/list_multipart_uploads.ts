import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, BucketResultOwner, checkBoolean, checkInteger, computeBucketUrl, parseBucketResultOwner, R2, s3Fetch, S3_XMLNS, throwIfUnexpectedContentType, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';
import { KnownElement } from './known_element.ts';

export type ListMultipartUploadsOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle, delimiter?: string, encodingType?: string, keyMarker?: string, maxUploads?: number, prefix?: string, uploadIdMarker?: string };

export async function listMultipartUploads(opts: ListMultipartUploadsOpts, context: AwsCallContext): Promise<ListMultipartUploadsResult> {
    const { bucket, origin, region, urlStyle, delimiter, encodingType, keyMarker, maxUploads, prefix, uploadIdMarker } = opts;
    const method = 'GET';
    const url = computeBucketUrl({ origin, bucket, urlStyle, subresource: 'uploads' });
    if (typeof delimiter === 'string') url.searchParams.set('delimiter', delimiter);
    if (typeof encodingType === 'string') url.searchParams.set('encoding-type', encodingType);
    if (typeof keyMarker === 'string') url.searchParams.set('key-marker', keyMarker);
    if (typeof maxUploads === 'number') url.searchParams.set('max-uploads', String(maxUploads));
    if (typeof prefix === 'string') url.searchParams.set('prefix', prefix);
    if (typeof uploadIdMarker === 'string') url.searchParams.set('upload-id-marker', uploadIdMarker);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200);
  
    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'application/xml', txt);

    const xml = parseXml(txt);
    return parseListBucketResultXml(xml);
}

//

export interface ListMultipartUploadsResult {
    readonly bucket: string;
    readonly keyMarker?: string;
    readonly uploadIdMarker?: string;
    readonly nextKeyMarker?: string;
    readonly prefix?: string;
    readonly delimiter?: string;
    readonly nextUploadIdMarker?: string;
    readonly maxUploads: number;
    readonly isTruncated: boolean;
    readonly uploads: readonly UploadItem[];
    readonly commonPrefixes?: readonly string[];
    readonly encodingType?: string;
}

export interface UploadItem {
    readonly checksumAlgorithm?: string;
    readonly initiated: string;
    readonly initiator: BucketResultOwner;
    readonly key: string;
    readonly owner: BucketResultOwner;
    readonly storageClass: string;
    readonly uploadId: string;
}

//

function parseListBucketResultXml(xml: ExtendedXmlNode): ListMultipartUploadsResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseListMultipartUploadsResult(doc.getKnownElement('ListMultipartUploadsResult', { xmlns: S3_XMLNS }));
    doc.check();
    return rt;
}

function parseListMultipartUploadsResult(element: KnownElement): ListMultipartUploadsResult {
    const bucket = element.getElementText('Bucket');
    const keyMarker = element.getOptionalElementText('KeyMarker');
    const uploadIdMarker = element.getOptionalElementText('UploadIdMarker');
    const nextKeyMarker = element.getOptionalElementText('NextKeyMarker');
    const prefix = element.getOptionalElementText('Prefix');
    const delimiter = element.getOptionalElementText('Delimiter');
    const nextUploadIdMarker = element.getOptionalElementText('NextUploadIdMarker');
    const maxUploads = element.getCheckedElementText('MaxUploads', checkInteger);
    const isTruncated = element.getCheckedElementText('IsTruncated', checkBoolean);
    const uploads = element.getKnownElements('Upload').map(parseUploadItem);
    const commonPrefixes = element.getKnownElements('CommonPrefixes').map(parseCommonPrefixes);
    const encodingType = element.getOptionalElementText('EncodingType');
    element.check();
    return { bucket, keyMarker, uploadIdMarker, nextKeyMarker, prefix, delimiter, nextUploadIdMarker, maxUploads, isTruncated, uploads, commonPrefixes, encodingType };
}

function parseUploadItem(element: KnownElement): UploadItem {
    const checksumAlgorithm = element.getOptionalElementText('ChecksumAlgorithm');
    const initiated = element.getElementText('Initiated');
    const initiator = parseBucketResultOwner(element.getKnownElement('Initiator'));
    const key = element.getElementText('Key');
    const owner = parseBucketResultOwner(element.getKnownElement('Owner'));
    const storageClass = element.getElementText('StorageClass');
    const uploadId = element.getElementText('UploadId');
    element.check();
    return { checksumAlgorithm, initiated, initiator, key, owner, storageClass, uploadId };
}

function parseCommonPrefixes(element: KnownElement): string {
    const rt = element.getElementText('Prefix');
    element.check();
    return rt;
}
