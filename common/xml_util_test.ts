import { assertEquals } from 'https://deno.land/std@0.176.0/testing/asserts.ts';

import { decodeXml, encodeXml } from './xml_util.ts';

Deno.test({
    name: 'decodeXml',
    fn: () => {
        assertEquals(decodeXml('a&apos;b'), `a'b`);
        assertEquals(decodeXml(encodeXml(`a<>'"&b`)), `a<>'"&b`);
    }
});
