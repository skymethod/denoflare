import { Config } from './config.ts';

export async function loadConfig(): Promise<Config> {
    const config = JSON.parse(await Deno.readTextFile(`${Deno.env.get('HOME')}/.denoflare`));
    return config as Config;
}
