import { ExtendedXmlNode, parseXml } from '../xml_parser.ts';
import { KnownElement } from './known_element.ts';
import { AwsCallContext, checkBoolean, R2, s3Fetch, throwIfUnexpectedContentType, throwIfUnexpectedStatus } from './r2.ts';

export type ObjectIdentifier = { key: string, versionId?: string };
export type DeleteObjectsOpts = { bucket: string, items: (string | ObjectIdentifier)[], origin: string, region: string, quiet?: boolean };

export async function deleteObjects(opts: DeleteObjectsOpts, context: AwsCallContext): Promise<DeleteResult> {
    const { bucket, items, origin, region, quiet } = opts;
    const method = 'POST';
    const url = new URL(`${origin}/${bucket}/?delete`);

    const body = computePayload(items, quiet);
    if (R2.DEBUG) console.log(body);
    const res = await s3Fetch({ method, url, body, region, context });
    await throwIfUnexpectedStatus(res, 200);

    const txt = await res.text();
    if (R2.DEBUG) console.log(txt);
    throwIfUnexpectedContentType(res, 'application/xml', txt);

    const xml = parseXml(txt);
    return parseDeleteResultXml(xml);
}

export interface DeleteResult {
    readonly deleted?: readonly DeletedItem[];
    readonly errors?: readonly ErrorItem[];
}

export interface DeletedItem {
    readonly deleteMarker?: boolean;
    readonly deleteMarkerVersionId?: string;
    readonly key: string;
    readonly versionId?: string;
}

export interface ErrorItem {
    readonly code: string;
    readonly key: string;
    readonly message: string;
    readonly versionId: string;
}

//

const computePayload = (items: (string | ObjectIdentifier)[], quiet?: boolean) => `<?xml version="1.0" encoding="UTF-8"?>
<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
${items.map(computeObjectElement).join('')}
${typeof quiet === 'boolean' ? `  <Quiet>${quiet}</Quiet>` : ''}
</Delete>`;

const computeObjectElement = (item: string | ObjectIdentifier) => `
  <Object>
    <Key>${typeof item === 'string' ? item : item.key}</Key>
${typeof item !== 'string' && typeof item.versionId === 'string' ? `    <VersionId>${item.versionId}</VersionId>` : ''}
  </Object>`;

function parseDeleteResultXml(xml: ExtendedXmlNode): DeleteResult {
    const doc = new KnownElement(xml).checkTagName('!xml');
    const rt = parseDeleteResult(doc.getKnownElement('DeleteResult'));
    doc.check();
    return rt;
}

function parseDeleteResult(element: KnownElement): DeleteResult {
    const deleted = element.getKnownElements('Deleted').map(parseDeletedItem);
    const errors = element.getKnownElements('Error').map(parseErrorItem);
    element.check();
    return { deleted: deleted.length > 0 ? deleted : undefined, errors: errors.length > 0 ? errors : undefined };
}

function parseDeletedItem(element: KnownElement): DeletedItem {
    const deleteMarker = element.getOptionalCheckedElementText('DeleteMarker', checkBoolean);
    const deleteMarkerVersionId = element.getOptionalElementText('DeleteMarkerVersionId');
    const key = element.getElementText('Key');
    const versionId = element.getOptionalElementText('VersionId');
    element.check();
    return { deleteMarker, deleteMarkerVersionId, key, versionId };
}

function parseErrorItem(element: KnownElement): ErrorItem {
    const code = element.getElementText('Code');
    const key = element.getElementText('Key');
    const message = element.getElementText('Message');
    const versionId = element.getElementText('VersionId');
    element.check();
    return { code, key, message, versionId };
}
