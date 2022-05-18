import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { AwsCallContext, computeBucketUrl, R2, s3Fetch, throwIfUnexpectedContentType, throwIfUnexpectedStatus, UrlStyle } from './r2.ts';
import { KnownElement } from './known_element.ts';

export type GetBucketEncryptionOpts = { bucket: string, origin: string, region: string, urlStyle?: UrlStyle };

export async function getBucketEncryption(opts: GetBucketEncryptionOpts, context: AwsCallContext): Promise<ServerSideEncryptionConfiguration> {
    const { bucket, origin, region, urlStyle } = opts;
    const method = 'GET';
    const url = computeBucketUrl({ origin, bucket, subresource: 'encryption', urlStyle });

    const res = await s3Fetch({ method, url, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);

    throwIfUnexpectedContentType(res, 'application/xml', txt);
    
    const xml = parseXml(txt);
    return parseServerSideEncryptionConfigurationXml(xml);
}

//

export interface ServerSideEncryptionConfiguration {
    readonly rules: readonly ServerSideEncryptionRule[]; 
}

export interface ServerSideEncryptionRule {
    readonly applyServerSideEncryptionByDefault: ServerSideEncryptionByDefault;
    readonly bucketKeyEnabled: boolean;
}

export interface ServerSideEncryptionByDefault {
    readonly sseAlgorithm: string; // e.g. AES256
}

//

function parseServerSideEncryptionConfigurationXml(xml: ExtendedXmlNode): ServerSideEncryptionConfiguration {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseServerSideEncryptionConfiguration(doc.getKnownElement('ServerSideEncryptionConfiguration'));
    doc.check();
    return rt;
}

function parseServerSideEncryptionConfiguration(element: KnownElement): ServerSideEncryptionConfiguration {
    const rules = element.getKnownElements('Rule').map(parseServerSideEncryptionRule);
    element.check();
    return { rules };
}

function parseServerSideEncryptionRule(element: KnownElement): ServerSideEncryptionRule {
    const bucketKeyEnabled = element.getElementText('BucketKeyEnabled') === 'true';
    const applyServerSideEncryptionByDefault = parseServerSideEncryptionByDefault(element.getKnownElement('ApplyServerSideEncryptionByDefault'));
    return { applyServerSideEncryptionByDefault, bucketKeyEnabled };
}

function parseServerSideEncryptionByDefault(element: KnownElement): ServerSideEncryptionByDefault {
    const sseAlgorithm = element.getElementText('SSEAlgorithm');
    return { sseAlgorithm };
}
