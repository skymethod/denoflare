import { assert } from 'https://deno.land/std@0.224.0/assert/assert.ts';

import { versionCompare } from './versions.ts';

Deno.test({
    name: 'versions',
    fn: () => {
        assert(versionCompare('1.0.0', '1.0.0') === 0);
        assert(versionCompare('1.21.3', '1.22.0') < 0);
        assert(versionCompare('1.21.3', '1.22') < 0);
        assert(versionCompare('1.21.4', '1.21') > 0);
        assert(versionCompare('1.21.4', '1.21.3') > 0);
        assert(versionCompare('1.21.3', '2.0') < 0);
    }
});
