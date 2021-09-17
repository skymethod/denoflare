export interface AppManifest {
    /**
     * https://w3c.github.io/manifest/#short_name-member
     * maximum of 12 characters recommended per https://developer.chrome.com/extensions/manifest/name
     * used: android launcher icon title
     */
    'short_name': string,

    /**
     * https://w3c.github.io/manifest/#name-member
     * maximum of 45 characters per https://developer.chrome.com/extensions/manifest/name
     * used: app install banner  android offline splash screen
     */
    name: string,

    /**
     * https://w3c.github.io/manifest/#description-member
     * used ??
     */
    description: string,

    /**
     * https://w3c.github.io/manifest/#icons-member
     */
    icons: readonly AppManifestIcon[],

    /**
     * https://w3c.github.io/manifest/#theme_color-member
     */
    'theme_color': string,

    /**
     * https://w3c.github.io/manifest/#background_color-member
     * should match page, also used for splash screen
     */
    'background_color': string,

    /**
     * https://w3c.github.io/manifest/#display-member
     */
    display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser',

    /**
     * https://w3c.github.io/manifest/#start_url-member
     */
    'start_url': string,

    /**
     * https://w3c.github.io/manifest/#lang-member
     */
    lang: 'en-US',

    /**
     * https://w3c.github.io/manifest/#dir-member
     */
    dir: 'ltr',

    /**
     * https://w3c.github.io/manifest/#scope-member
     */
    scope?: string,

}

export interface AppManifestIcon {

    /**
     * url to image resource
     */
    src: string;

    /**
     * e.g. "512x512", or "16x16 32x32 48x48"
     * 
     * https://w3c.github.io/manifest/#declaring-multiple-icons
     */
    sizes?: string;

    /**
     * MIME type
     * 
     * https://w3c.github.io/manifest/#declaring-multiple-icons
     */
    type?: string;

    /**
     * https://w3c.github.io/manifest/#purpose-member
     */
    purpose?: 'monochrome' | 'maskable' | 'any';
}
