import { assertEquals } from 'https://deno.land/std@0.201.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.201.0/assert/assert_rejects.ts';

import { resolveBindings, resolveProfile } from './config_loader.ts';
import { Binding, Config } from '../common/config.ts';

Deno.test({
    name: 'resolveBindings',
    fn: async () => {
        const opts = makeOpts();
        const input: Record<string, Binding> = {
            text1: { value: '${pushId}' },
            text2: { value: '${localPort}' },
            text3: { value: '${aws:foo}' },
            text4: { value: 'asdf' },
            text5: { value: 'pre${env:foo}post' },
            kv1: { kvNamespace: '${env:foo}' },
        };
        const output = await resolveBindings(input, opts);
        assertEquals(input, input); // ensure input not modified
        assertEquals(output, {
            text1: { value: 'the-push-id' },
            text2: { value: '123' },
            text3: { value: 'ak:sak' },
            text4: { value: 'asdf' },
            text5: { value: 'prebarpost' },
            kv1: { kvNamespace: 'bar' },
        });
        assertRejects(async () => {
            await resolveBindings({ bad: { value: '${asdf}' } }, opts);
        })
    }
});

Deno.test({
    name: 'resolveProfile',
    fn: async () => {
        const opts = makeOpts();
        const config: Config = { profiles: { first: { accountId: 'account-id', apiToken: '${env:API_TOKEN}' } } };
        const profile = await resolveProfile(config, {}, undefined, opts);
        assertEquals(profile as unknown, { accountId: 'account-id', apiToken: 'api-token' });
    }
});

//

function makeOpts() {
    const awsCredentialsLoader = async (profile: string) => {
        await Promise.resolve();
        if (profile === 'foo') return { accessKeyId: 'ak', secretAccessKey: 'sak' };
        throw new Error(`Profile ${profile} not found`);
    };
    const envLoader = (name: string) => new Map([['foo', 'bar'], ['API_TOKEN', 'api-token']]).get(name);
    return { localPort: 123, pushId: 'the-push-id', awsCredentialsLoader, envLoader };
}
