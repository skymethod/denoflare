import { checkObject } from '../common/check.ts';
import { SiteConfig } from './site_generator.ts';

// deno-lint-ignore no-explicit-any
export function checkSiteConfig(config: any): SiteConfig {
    checkObject('config', config);

    const { title, description, origin, twitterUsername, themeColor, themeColorDark } = config;
    if (typeof title !== 'string' || title === '') throw new Error(`Bad title: ${title}`);
    if (typeof description !== 'string' || description === '') throw new Error(`Bad description: ${description}`);
    if (typeof origin !== 'string' || origin === '') throw new Error(`Bad origin: ${origin}`);
    if (twitterUsername !== undefined && (typeof twitterUsername !== 'string' || twitterUsername === '')) throw new Error(`Bad twitterUsername: ${twitterUsername}`);
    checkThemeColor('themeColor', themeColor);
    checkThemeColor('themeColorDark', themeColorDark);
    if (themeColorDark && !themeColor) throw new Error(`themeColor required when themeColorDark defined`);
    return { title, description, origin, twitterUsername, themeColor, themeColorDark };
}

//

// deno-lint-ignore no-explicit-any
function checkThemeColor(name: string, value: any): value is string | undefined {
    if (value === undefined) return true;
    if (typeof value === 'string') {
        if (!/^#[a-fA-F0-9]{6}$/.test(value)) throw new Error(`Bad ${name}: ${value}`);
    }
    return true;
}
