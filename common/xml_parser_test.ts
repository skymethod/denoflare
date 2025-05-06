import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { parseXml } from './xml_parser.ts';

Deno.test({
    name: 'parseXml',
    fn: () => {
        // workaround for valid xml that fast-xml does not handle
        const n = parseXml(`<?xml version="1.0" encoding="UTF-8"?>\n<root\nxmlns:name2="https://example.com/namespace/1.0"\n/>`);
        assertEquals(Object.keys(n.child).length, 1);
        assertEquals(Object.values(n.child)[0][0].tagname, 'root');
        assertEquals(Object.values(n.child)[0][0].attrsMap, { '@_xmlns:name2': 'https://example.com/namespace/1.0' });
    }
});
