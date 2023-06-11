import { assertEquals, assertRejects } from 'https://deno.land/std@0.191.0/testing/asserts.ts';

import { resolveBindings } from './config_loader.ts';
import { Binding } from '../common/config.ts';

Deno.test({
    name: 'resolveBindings',
    fn: async () => {
        const input: Record<string, Binding> = {
            text1: { value: '${pushId}' },
            text2: { value: '${localPort}' },
            text3: { value: '${aws:foo}' },
            text4: { value: 'asdf' },
            text5: { value: 'pre${env:foo}post' },
            kv1: { kvNamespace: '${env:foo}' },
        };
        const awsCredentialsLoader = async (profile: string) => {
            await Promise.resolve();
            if (profile === 'foo') return { accessKeyId: 'ak', secretAccessKey: 'sak' };
            throw new Error(`Profile ${profile} not found`);
        };
        const envLoader = (name: string) => new Map([['foo', 'bar']]).get(name);
        const opts = { localPort: 123, pushId: 'the-push-id', awsCredentialsLoader, envLoader };
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
