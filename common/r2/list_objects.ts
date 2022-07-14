import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, BucketResultOwner, checkBoolean, checkInteger, computeBucketUrl, parseBucketResultOwner, R2, s3Fetch, S3_XMLNS, throwIfUnexpectedContentType, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';
import { KnownElement } from './known_element.ts';

export type ListObjectsOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle, maxKeys?: number, marker?: string, delimiter?: string, prefix?: string, encodingType?: string };

export async function listObjects(opts: ListObjectsOpts, context: AwsCallContext): Promise<ListBucketResult> {
    const { bucket, origin, region, urlStyle, maxKeys, marker, delimiter, prefix, encodingType } = opts;
    const method = 'GET';
    const url = computeBucketUrl({ origin, bucket, urlStyle });
    if (typeof maxKeys === 'number') url.searchParams.set('max-keys', String(maxKeys));
    if (typeof marker === 'string') url.searchParams.set('marker', marker);
    if (typeof delimiter === 'string') url.searchParams.set('delimiter', delimiter);
    if (typeof prefix === 'string') url.searchParams.set('prefix', prefix);
    if (typeof encodingType === 'string') url.searchParams.set('encoding-type', encodingType);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200);
  
    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'application/xml', txt);

    const xml = parseXml(txt);
    return parseListBucketResultXml(xml);
}

//

export interface ListBucketResult {
    readonly isTruncated: boolean;
    readonly name: string;
    readonly prefix?: string;
    readonly maxKeys: number;
    readonly contents: ListBucketResultItem[];
    readonly commonPrefixes?: readonly string[];
    readonly keyCount: number;
    readonly marker?: string;
    readonly nextMarker?: string;
    readonly delimiter?: string;
    readonly encodingType?: string;
}

export interface ListBucketResultItem {
    readonly key: string;
    readonly size: number;
    readonly lastModified: string;
    readonly owner: BucketResultOwner;
    readonly etag: string;
    readonly storageClass?: string;
}

//

function parseListBucketResultXml(xml: ExtendedXmlNode): ListBucketResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseListBucketResult(doc.getKnownElement('ListBucketResult', { xmlns: S3_XMLNS }));
    doc.check();
    return rt;
}

function parseListBucketResult(element: KnownElement): ListBucketResult {
    const name = element.getElementText('Name');
    const contents = element.getKnownElements('Contents').map(parseListBucketResultItem);
    const isTruncated = element.getCheckedElementText('IsTruncated', checkBoolean);
    const maxKeys = element.getCheckedElementText('MaxKeys', checkInteger);
    const keyCount = element.getCheckedElementText('KeyCount', checkInteger);
    const marker = element.getOptionalElementText('Marker');
    const nextMarker = element.getOptionalElementText('NextMarker');
    const delimiter = element.getOptionalElementText('Delimiter');
    const prefix = element.getOptionalElementText('Prefix');
    const encodingType = element.getOptionalElementText('EncodingType');
    const commonPrefixes = element.getKnownElements('CommonPrefixes').map(parseCommonPrefixes);
    element.check();
    return { name, isTruncated, maxKeys, keyCount, contents, nextMarker, delimiter, commonPrefixes, marker, prefix, encodingType };
}

function parseListBucketResultItem(element: KnownElement): ListBucketResultItem {
    const key = element.getElementText('Key');
    const size = element.getCheckedElementText('Size', checkInteger);
    const lastModified = element.getElementText('LastModified');
    const owner = parseBucketResultOwner(element.getKnownElement('Owner'));
    const etag = element.getElementText('ETag');
    const storageClass = element.getOptionalElementText('StorageClass');
    element.check();
    return { key, size, lastModified, owner, etag, storageClass };
}

function parseCommonPrefixes(element: KnownElement): string {
    const rt = element.getElementText('Prefix');
    element.check();
    return rt;
}
