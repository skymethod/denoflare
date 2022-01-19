export interface SiteConfig {

    // leave these out if no org
    readonly organization?: string; // short first (bold) part of org name
    readonly organizationSuffix?: string; // short second part of org name
    readonly organizationSvg?: string; // content repo /path/to/organization.svg must use fill="currentColor"
    readonly organizationUrl?: string; // abs url to org

    readonly product: string; // (required) product name for sidebar, etc
    readonly productRepo?: string; // e.g. "ghuser/project-repo", used for gh link in header
    readonly productSvg?: string; // content repo /path/to/product.svg must use fill="currentColor" 
    readonly contentRepo?: string; // e.g. "ghuser/docs-repo", used for edit this page in footer

    readonly themeColor?: string; // #rrggbb
    readonly themeColorDark?: string; // #rrggbb

    readonly search?: SiteSearchConfig; // Algolia DocSearch options, if applicable

    readonly siteMetadata: SiteMetadata; // (required for title, description)
}

export interface SiteMetadata {
    readonly title: string; // (required) (html title, og:title, twitter:title) = <page title> · <siteMetadata.title>
    readonly description: string; // (required) (html meta description, og:description, twitter:description) = <siteMetadata.description>
    readonly twitterUsername?: string; // @asdf for twitter:site
    readonly image?: string; // abs or relative url to twitter:image
    readonly imageAlt?: string; // alt text for twitter:image
    readonly origin?: string; // abs url to site (origin)
    readonly faviconIco?: string; // relative url favicon ico
    readonly faviconSvg?: string; // relative url favicon svg
    readonly faviconMaskSvg?: string; // relative url favicon mask svg
    readonly faviconMaskColor?: string; // #rrggbb favicon mask color (required if faviconMaskSvg provided)
    readonly manifest?: Record<string, unknown>; // override default web app manifest members
}

export interface SiteSearchConfig {
    readonly indexName: string; // (required) Name of the Algolia DocSearch index name for this site
    readonly apiKey: string; // (required) Api key provided by Algolia for this site
    readonly appId: string; // (required) Application ID provided by Algolia for this site
}
