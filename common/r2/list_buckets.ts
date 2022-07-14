import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, BucketResultOwner, parseBucketResultOwner, R2, s3Fetch, S3_XMLNS, throwIfUnexpectedContentType, throwIfUnexpectedStatus } from './r2.ts';
import { KnownElement } from './known_element.ts';

export type ListBucketsOpts = { origin: string, region: string };

export async function listBuckets(opts: ListBucketsOpts, context: AwsCallContext): Promise<ListBucketsResult> {
    const { origin, region } = opts;
    const method = 'GET';
    const url = new URL(`${origin}/`);

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);

    throwIfUnexpectedContentType(res, 'application/xml', txt);
    
    const xml = parseXml(txt);
    return parseListBucketsResultXml(xml);
}

//

export interface ListBucketsResult {
    readonly buckets: readonly ListBucketsBucketItem[];
    readonly owner: BucketResultOwner;
}

export interface ListBucketsBucketItem {
    readonly name: string;
    readonly creationDate: string;
}

//

function parseListBucketsResultXml(xml: ExtendedXmlNode): ListBucketsResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseListBucketsResult(doc.getKnownElement('ListAllMyBucketsResult', { xmlns: S3_XMLNS }));
    doc.check();
    return rt;
}

function parseListBucketsResult(element: KnownElement): ListBucketsResult {
    const owner = parseBucketResultOwner(element.getKnownElement('Owner'));
    const buckets = parseBuckets(element.getKnownElement('Buckets'));

    element.check();
    return { owner, buckets };
}

function parseBuckets(element: KnownElement): ListBucketsBucketItem[] {
    const rt = element.getKnownElements('Bucket').map(parseListBucketsBucketItem);
    element.check();
    return rt;
}

function parseListBucketsBucketItem(element: KnownElement): ListBucketsBucketItem {
    const creationDate = element.getElementText('CreationDate');
    const name = element.getElementText('Name');

    element.check();
    return { creationDate, name };
}
