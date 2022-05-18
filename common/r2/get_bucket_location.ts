import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, computeBucketUrl, R2, s3Fetch, throwIfUnexpectedContentType, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';
import { KnownElement } from './known_element.ts';

export type GetBucketLocationOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle };

export async function getBucketLocation(opts: GetBucketLocationOpts, context: AwsCallContext): Promise<LocationConstraint> {
    const { bucket, origin, region, urlStyle } = opts;
    const method = 'GET';
    const url = computeBucketUrl({ origin, bucket, subresource: 'location', urlStyle });

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);

    throwIfUnexpectedContentType(res, 'application/xml', txt);
    
    const xml = parseXml(txt);
    return parseLocationConstraintXml(xml);
}

//

export interface LocationConstraint {
    readonly locationConstraint?: string;
}

//

function parseLocationConstraintXml(xml: ExtendedXmlNode): LocationConstraint {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const locationConstraint = doc.getOptionalElementText('LocationConstraint');
    doc.check();
    return { locationConstraint };
}
