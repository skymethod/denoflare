import { assertEquals, assertThrows } from 'https://deno.land/std@0.199.0/testing/asserts.ts';

import { parseFlags } from './flag_parser.ts';

Deno.test({
    name: 'parseFlags',
    fn: () => {
        const good: [ string[], (string | number)[], Record<string, unknown> ][] = [
            [ [], [], {} ],
            [ [ 'one' ], [ 'one' ], {} ],
            [ [ '--bool' ], [], { bool: true} ],
            [ [ 'arg', '--foo', 'bar' ], [ 'arg' ], { foo: 'bar'} ],
            [ [ '--foo', 'bar', '--foo' ], [], { foo: ['bar', true]} ],
            [ [ '--foo', 'bar', '--foo', 'baz' ], [], { foo: ['bar', 'baz']} ],
            [ [ '--bool', 'true' ], [], { bool: true } ],
            [ [ '--bool', 'True' ], [], { bool: true } ],
            [ [ '--bool', 'false' ], [], { bool: false } ],
            [ [ '--bool', 'FALSE' ], [], { bool: false } ],
            [ [ '--int', '0' ], [], { int: 0 } ],
            [ [ '--int', '-0' ], [], { int: 0 } ],
            [ [ '--int', '123456' ], [], { int: 123456 } ],
            [ [ '--float', '0.123456' ], [], { float: 0.123456 } ],
            [ [ '--float', '-123.123456' ], [], { float: -123.123456 } ],
            [ [ '--string', '-123.123456.0' ], [], { string: '-123.123456.0' } ],
            [ [ '--string', '-123.123456.0' ], [], { string: '-123.123456.0' } ],
            [ [ '', 'a b' ], ['', 'a b'], { } ],
            [ [ 'cfapi', 'list-scripts', '--per-page', '1', '--verbose' ], [ 'cfapi', 'list-scripts' ], { 'per-page': 1, verbose: true } ],
        ];
        for (const [ input, args, options] of good) {
            assertEquals(parseFlags(input), { args, options });
        }
        const bad: (string[])[] = [
            ['--foo', 'bar', 'baz' ],
        ];
        for (const input of bad) {
            assertThrows(() => parseFlags(input));
        }
    }
});
