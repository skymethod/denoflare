
//#region Copied from workers-types with minimal tweaking

/**
 * Request metadata provided by Cloudflare's edge.
 */
export type IncomingRequestCfProperties<HostMetadata = unknown> =
    IncomingRequestCfPropertiesBase &
    IncomingRequestCfPropertiesBotManagementEnterprise &
    IncomingRequestCfPropertiesCloudflareForSaaSEnterprise<HostMetadata> &
    IncomingRequestCfPropertiesGeographicInformation &
    IncomingRequestCfPropertiesCloudflareAccessOrApiShield;

interface IncomingRequestCfPropertiesBase {
    /**
     * [ASN](https://www.iana.org/assignments/as-numbers/as-numbers.xhtml) of the incoming request.
     *
     * @example 395747
     */
    readonly asn: number;
    /**
     * The organization which owns the ASN of the incoming request.
     *
     * @example "Google Cloud"
     */
    readonly asOrganization: string;
    /**
     * The original value of the `Accept-Encoding` header if Cloudflare modified it.
     *
     * @example "gzip, deflate, br"
     */
    readonly clientAcceptEncoding?: string;
    /**
     * The number of milliseconds it took for the request to reach your worker.
     *
     * @example 22
     */
    readonly clientTcpRtt?: number;
    /**
     * The three-letter [IATA](https://en.wikipedia.org/wiki/IATA_airport_code)
     * airport code of the data center that the request hit.
     *
     * @example "DFW"
     */
    readonly colo: string;
    /**
     * Represents the upstream's response to a
     * [TCP `keepalive` message](https://tldp.org/HOWTO/TCP-Keepalive-HOWTO/overview.html)
     * from cloudflare.
     *
     * For workers with no upstream, this will always be `1`.
     *
     * @example 3
     */
    readonly edgeRequestKeepAliveStatus: IncomingRequestCfPropertiesEdgeRequestKeepAliveStatus;
    /**
     * The HTTP Protocol the request used.
     *
     * @example "HTTP/2"
     */
    readonly httpProtocol: string;
    /**
     * The browser-requested prioritization information in the request object.
     *
     * If no information was set, defaults to the empty string `""`
     *
     * @example "weight=192;exclusive=0;group=3;group-weight=127"
     * @default ""
     */
    readonly requestPriority: string;
    /**
     * The TLS version of the connection to Cloudflare.
     * In requests served over plaintext (without TLS), this property is the empty string `""`.
     *
     * @example "TLSv1.3"
     */
    readonly tlsVersion: string;
    /**
     * The cipher for the connection to Cloudflare.
     * In requests served over plaintext (without TLS), this property is the empty string `""`.
     *
     * @example "AEAD-AES128-GCM-SHA256"
     */
    readonly tlsCipher: string;
    /**
     * Metadata containing the [`HELLO`](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.2) and [`FINISHED`](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.9) messages from this request's TLS handshake.
     *
     * If the incoming request was served over plaintext (without TLS) this field is undefined.
     */
    readonly tlsExportedAuthenticator?: IncomingRequestCfPropertiesExportedAuthenticatorMetadata;
}

/**
 * Metadata about the request's TLS handshake
 */
interface IncomingRequestCfPropertiesExportedAuthenticatorMetadata {
    /**
     * The client's [`HELLO` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.2), encoded in hexadecimal
     *
     * @example "44372ba35fa1270921d318f34c12f155dc87b682cf36a790cfaa3ba8737a1b5d"
     */
    readonly clientHandshake: string;
    /**
     * The server's [`HELLO` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.1.2), encoded in hexadecimal
     *
     * @example "44372ba35fa1270921d318f34c12f155dc87b682cf36a790cfaa3ba8737a1b5d"
     */
    readonly serverHandshake: string;
    /**
     * The client's [`FINISHED` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.9), encoded in hexadecimal
     *
     * @example "084ee802fe1348f688220e2a6040a05b2199a761f33cf753abb1b006792d3f8b"
     */
    readonly clientFinished: string;
    /**
     * The server's [`FINISHED` message](https://www.rfc-editor.org/rfc/rfc5246#section-7.4.9), encoded in hexadecimal
     *
     * @example "084ee802fe1348f688220e2a6040a05b2199a761f33cf753abb1b006792d3f8b"
     */
    readonly serverFinished: string;
}

/**
 * An upstream endpoint's response to a TCP `keepalive` message from Cloudflare.
 */
export type IncomingRequestCfPropertiesEdgeRequestKeepAliveStatus =
    | 0 /** Unknown */
    | 1 /** no keepalives (not found) */
    | 2 /** no connection re-use, opening keepalive connection failed */
    | 3 /** no connection re-use, keepalive accepted and saved */
    | 4 /** connection re-use, refused by the origin server (`TCP FIN`) */
    | 5; /** connection re-use, accepted by the origin server */

interface IncomingRequestCfPropertiesBotManagementBase {
    /**
     * Cloudflare’s [level of certainty](https://developers.cloudflare.com/bots/concepts/bot-score/) that a request comes from a bot,
     * represented as an integer percentage between `1` (almost certainly human)
     * and `99` (almost certainly a bot).
     *
     * @example 54
     */
    readonly score: number;
    /**
     * A boolean value that is true if the request comes from a good bot, like Google or Bing.
     * Most customers choose to allow this traffic. For more details, see [Traffic from known bots](https://developers.cloudflare.com/firewall/known-issues-and-faq/#how-does-firewall-rules-handle-traffic-from-known-bots).
     */
    readonly verifiedBot: boolean;
    /**
     * A boolean value that is true if the request originates from a
     * Cloudflare-verified proxy service.
     */
    readonly corporateProxy: boolean;
    /**
     * A boolean value that's true if the request matches [file extensions](https://developers.cloudflare.com/bots/reference/static-resources/) for many types of static resources.
     */
    readonly staticResource: boolean;
}

interface IncomingRequestCfPropertiesBotManagement {
    /**
     * Results of Cloudflare's Bot Management analysis
     */
    readonly botManagement: IncomingRequestCfPropertiesBotManagementBase;
    /**
     * Duplicate of `botManagement.score`.
     *
     * @deprecated
     */
    readonly clientTrustScore: number;
}

interface IncomingRequestCfPropertiesBotManagementEnterprise
    extends IncomingRequestCfPropertiesBotManagement {
    /**
     * Results of Cloudflare's Bot Management analysis
     */
    readonly botManagement: IncomingRequestCfPropertiesBotManagementBase & {
        /**
         * A [JA3 Fingerprint](https://developers.cloudflare.com/bots/concepts/ja3-fingerprint/) to help profile specific SSL/TLS clients
         * across different destination IPs, Ports, and X509 certificates.
         */
        readonly ja3Hash: string;
    };
}

interface IncomingRequestCfPropertiesCloudflareForSaaSEnterprise<HostMetadata> {
    /**
     * Custom metadata set per-host in [Cloudflare for SaaS](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/).
     *
     * This field is only present if you have Cloudflare for SaaS enabled on your account
     * and you have followed the [required steps to enable it]((https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/custom-metadata/)).
     */
    readonly hostMetadata: HostMetadata;
}

/**
 * Geographic data about the request's origin.
 */
type IncomingRequestCfPropertiesGeographicInformation =
    | Record<never, never> // No geographic data was found for the incoming request.
    | {
        /** The country code `"T1"` is used for requests originating on TOR  */
        readonly country: 'T1';
    }
    | {
        /**
         * The [ISO 3166-1 Alpha 2](https://www.iso.org/iso-3166-country-codes.html) country code the request originated from.
         *
         * If your worker is [configured to accept TOR connections](https://support.cloudflare.com/hc/en-us/articles/203306930-Understanding-Cloudflare-Tor-support-and-Onion-Routing), this may also be `"T1"`, indicating a request that originated over TOR.
         *
         * If Cloudflare is unable to determine where the request originated this property is omitted.
         *
         * @example "GB"
         */
        readonly country: string;
        /**
         * If present, this property indicates that the request originated in the EU
         *
         * @example "1"
         */
        readonly isEUCountry?: '1';
        /**
         * A two-letter code indicating the continent the request originated from.
         *
         * @example "AN"
         */
        readonly continent: string;
        /**
         * The city the request originated from
         *
         * @example "Austin"
         */
        readonly city?: string;
        /**
         * Postal code of the incoming request
         *
         * @example "78701"
         */
        readonly postalCode?: string;
        /**
         * Latitude of the incoming request
         *
         * @example "30.27130"
         */
        readonly latitude?: string;
        /**
         * Longitude of the incoming request
         *
         * @example "-97.74260"
         */
        readonly longitude?: string;
        /**
         * Timezone of the incoming request
         *
         * @example "America/Chicago"
         */
        readonly timezone?: string;
        /**
         * If known, the ISO 3166-2 name for the first level region associated with
         * the IP address of the incoming request
         *
         * @example "Texas"
         */
        readonly region?: string;
        /**
         * If known, the ISO 3166-2 code for the first-level region associated with
         * the IP address of the incoming request
         *
         * @example "TX"
         */
        readonly regionCode?: string;
        /**
         * Metro code (DMA) of the incoming request
         *
         * @example "635"
         */
        readonly metroCode?: string;
    };

interface IncomingRequestCfPropertiesCloudflareAccessOrApiShield {
    /**
     * Information about the client certificate presented to Cloudflare.
     *
     * This is populated when the incoming request is served over TLS using
     * either Cloudflare Access or API Shield (mTLS)
     * and the presented SSL certificate has a valid
     * [Certificate Serial Number](https://ldapwiki.com/wiki/Certificate%20Serial%20Number)
     * (i.e., not `null` or `""`).
     *
     * Otherwise, a set of placeholder values are used.
     *
     * The property `certPresented` will be set to `"1"` when
     * the object is populated (i.e. the above conditions were met).
     */
    readonly tlsClientAuth:
    | IncomingRequestCfPropertiesTLSClientAuth
    | IncomingRequestCfPropertiesTLSClientAuthPlaceholder;
}

/** Placeholder values for TLS Client Authorization */
interface IncomingRequestCfPropertiesTLSClientAuthPlaceholder {
    certPresented: "0";
    certVerified: "NONE";
    certRevoked: "0";
    certIssuerDN: "";
    certSubjectDN: "";
    certIssuerDNRFC2253: "";
    certSubjectDNRFC2253: "";
    certIssuerDNLegacy: "";
    certSubjectDNLegacy: "";
    certSerial: "";
    certIssuerSerial: "";
    certSKI: "";
    certIssuerSKI: "";
    certFingerprintSHA1: "";
    certFingerprintSHA256: "";
    certNotBefore: "";
    certNotAfter: "";
}

/** Data about the incoming request's TLS certificate */
interface IncomingRequestCfPropertiesTLSClientAuth {
    /** Always `"1"`, indicating that the certificate was presented */
    readonly certPresented: '1';
    /**
     * Result of certificate verification.
     *
     * @example "FAILED:self signed certificate"
     */
    readonly certVerified: string;
    /** The presented certificate's revokation status.
     *
     * - A value of `"1"` indicates the certificate has been revoked
     * - A value of `"0"` indicates the certificate has not been revoked
     */
    readonly certRevoked: '1' | '0';
    /**
     * The certificate issuer's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html)
     *
     * @example "CN=cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    readonly certIssuerDN: string;
    /**
     * The certificate subject's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html)
     *
     * @example "CN=*.cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    readonly certSubjectDN: string;
    /**
     * The certificate issuer's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html) ([RFC 2253](https://www.rfc-editor.org/rfc/rfc2253.html) formatted)
     *
     * @example "CN=cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    readonly certIssuerDNRFC2253: string;
    /**
     * The certificate subject's [distinguished name](https://knowledge.digicert.com/generalinformation/INFO1745.html) ([RFC 2253](https://www.rfc-editor.org/rfc/rfc2253.html) formatted)
     *
     * @example "CN=*.cloudflareaccess.com, C=US, ST=Texas, L=Austin, O=Cloudflare"
     */
    readonly zcertSubjectDNRFC2253: string;
    /** The certificate issuer's distinguished name (legacy policies) */
    readonly zcertIssuerDNLegacy: string;
    /** The certificate subject's distinguished name (legacy policies) */
    readonly certSubjectDNLegacy: string;
    /**
     * The certificate's serial number
     *
     * @example "00936EACBE07F201DF"
     */
    readonly certSerial: string;
    /**
     * The certificate issuer's serial number
     *
     * @example "2489002934BDFEA34"
     */
    readonly certIssuerSerial: string;
    /**
     * The certificate's Subject Key Identifier
     *
     * @example "BB:AF:7E:02:3D:FA:A6:F1:3C:84:8E:AD:EE:38:98:EC:D9:32:32:D4"
     */
    readonly certSKI: string;
    /**
     * The certificate issuer's Subject Key Identifier
     *
     * @example "BB:AF:7E:02:3D:FA:A6:F1:3C:84:8E:AD:EE:38:98:EC:D9:32:32:D4"
     */
    readonly certIssuerSKI: string;
    /**
     * The certificate's SHA-1 fingerprint
     *
     * @example "6b9109f323999e52259cda7373ff0b4d26bd232e"
     */
    readonly certFingerprintSHA1: string;
    /**
     * The certificate's SHA-256 fingerprint
     *
     * @example "acf77cf37b4156a2708e34c4eb755f9b5dbbe5ebb55adfec8f11493438d19e6ad3f157f81fa3b98278453d5652b0c1fd1d71e5695ae4d709803a4d3f39de9dea"
     */
    readonly certFingerprintSHA256: string;
    /**
     * The effective starting date of the certificate
     *
     * @example "Dec 22 19:39:00 2018 GMT"
     */
    readonly certNotBefore: string;
    /**
     * The effective expiration date of the certificate
     *
     * @example "Dec 22 19:39:00 2018 GMT"
     */
    readonly certNotAfter: string;
}

//#endregion

//#region Common worker types (used in both script and module workers)

export interface WorkerContextMethods {
    /** Prevents requests from failing due to an unhandled exception thrown by the Worker, causing it instead to “fail open”. 
     * 
     * Instead of returning an error response, the runtime will proxy the request to the origin server as though the Worker was never invoked. */
    passThroughOnException(): void;

    /** Extend the lifetime of the event without blocking the response from being sent. 
     * 
     * Use this method to notify the runtime to wait for tasks (e.g. logging, analytics to third-party services, streaming and caching) 
     * that need to run longer than the usual time it takes to send a response. */
    waitUntil(promise: Promise<unknown>): void;
}

export interface ScheduledEventProperties {
    /** The time the ScheduledEvent was scheduled to be executed in milliseconds since January 1, 1970, UTC. 
     * 
     * It can be parsed as new Date(event.scheduledTime) */
    readonly scheduledTime: number;

    /** The original cron string that the event was scheduled for. */
    readonly cron: string;
}

export interface Fetcher {
    fetch(requestOrUrl: Request | string, requestInit?: RequestInit | Request): Promise<Response>;
}

export interface IncomingRequestCf extends Request {
    /** An object containing properties about the incoming request provided by Cloudflare’s edge network. */
    readonly cf: IncomingRequestCfProperties;

    // undocumented
    readonly fetcher: Fetcher | null;
}

//#endregion

//#region Script (non-module) worker types

// https://developers.cloudflare.com/workers/runtime-apis/fetch-event
export interface FetchEvent extends WorkerContextMethods {
    /** The type of event. */
    readonly type: 'fetch';

    /** The incoming HTTP request triggering FetchEvent. */
    readonly request: IncomingRequestCf;

    /** Intercept the request and send a custom response. 
     * 
     * If no event handler calls respondWith() the runtime attempts to request the origin as if no Worker script exists. 
     * If no origin is setup (e.g. workers.dev sites), then the Workers script must call respondWith() for a valid response. */
    respondWith(promise: Response | Promise<Response>): void;
}

// https://developers.cloudflare.com/workers/runtime-apis/scheduled-event
export interface ScheduledEvent extends ScheduledEventProperties {
    /** The type of event. */
    readonly type: 'scheduled';

    /** Use this method to notify the runtime to wait for asynchronous tasks (e.g. logging, analytics to third-party services, streaming and caching). 
     * 
     * The first event.waitUntil to fail will be observed and recorded as the status in the Cron Trigger Past Events table. Otherwise, it will be reported as a Success. 
     * 
     * 15 minute wall time limit, in addition to the existing CPU time limit */
    waitUntil(promise: Promise<unknown>): void;
}

//#endregion

//#region ES Module worker types

/*
export default {
    fetch(request: IncomingRequestCf, env: MyWorkerEnv, ctx: ModuleWorkerContext): Promise<Response>;
    scheduled(event: ModuleWorkerScheduledEvent, env: MyWorkerEnv, ctx: ModuleWorkerContext): Promise<void>;
    alarm(): Promise<void>;
    queue(batch: QueueMessageBatch, env: MyWorkerEnv, ctx: ModuleWorkerContext): Promise<void>;
    email(message: IncomingEmailMessage, env: MyWorkerEnv, ctx: ModuleWorkerContext): Promise<void>;
};
*/

export interface ModuleWorkerContext extends WorkerContextMethods {

}

export interface ModuleWorkerScheduledEvent extends ScheduledEventProperties {

}

//#endregion

//#region Workers KV https://developers.cloudflare.com/workers/runtime-apis/kv

export interface KVGetOptions {
    // https://developers.cloudflare.com/workers/runtime-apis/kv#cache-ttl

    /** The cacheTtl parameter must be an integer that is greater than or equal to 60. 
     * 
     * It defines the length of time in seconds that a KV result is cached in the edge location that it is accessed from. 
     * This can be useful for reducing cold read latency on keys that are read relatively infrequently. 
     * It is especially useful if your data is write-once or write-rarely, but is not recommended if your data is updated often 
     * and you need to see updates shortly after they're written, because writes that happen from other edge locations 
     * won't be visible until the cached value expires.
     * 
     * The effective Cache TTL of an already cached item can be reduced by getting it again it with a lower cacheTtl. 
     * For example, if you did NAMESPACE.get(key, {cacheTtl: 86400}) but later realized that caching for 24 hours was too long, 
     * you could NAMESPACE.get(key, {cacheTtl: 300}) or even NAMESPACE.get(key) and it would check for newer data to respect 
     * the provided cacheTtl, which defaults to 60. */
    readonly cacheTtl?: number;
}

/** Many common uses of Workers KV involve writing keys that are only meant to be valid for a certain amount of time. 
 * 
 * Rather than requiring applications to remember to delete such data at the appropriate time, Workers KV offers the ability to create keys that automatically expire, 
 * either at a particular point in time or after a certain amount of time has passed since the key was last modified.
 * 
 * Once the expiration time of an expiring key is reached, it will be deleted from the system. After its deletion, attempts to read it will behave as if the key does not exist, 
 * and it will not count against the namespace’s storage usage for billing purposes. 
 * 
 * Note that expiration times of less than 60 seconds in the future or expiration TTLs of less than 60 seconds are not supported at this time. */
export interface KVPutOptions {

    /** Absolute expiration time specified in a number of seconds since the UNIX epoch. 
     * 
     * For example, if you wanted a key to expire at 12:00AM UTC on April 1, 2019, you would set the key’s expiration to 1554076800. */
    readonly expiration?: number;

    /** Expiration TTL (time to live), using a relative number of seconds from the current time. 
     * 
     * For example, if you wanted a key to expire 10 minutes after creating it, you would set its expiration TTL to 600. */
    readonly expirationTtl?: number;

    /** Metadata to associate with the key-value pair.
     * 
     * The serialized JSON representation of the metadata object must be no more than 1024 bytes in length. */
    readonly metadata?: Record<string, unknown>;
}

export interface KVListOptions {
    /** A prefix you can use to filter all keys. */
    readonly prefix?: string;

    /** The maximum number of keys returned. The default is 1000, which is the maximum. 
     * 
     * It is unlikely that you will want to change this default, but it is included for completeness. */
    readonly limit?: number;

    /** A string used for paginating responses. */
    readonly cursor?: string;
}

export interface KVListResultKey {
    /** The name of the key. */
    readonly name: string;

    /** The expiration value will only be returned if the key has an expiration, and will be in the absolute value form, even if it was set in the TTL form. */
    readonly expiration?: number;
    
    /** Metadata will only be returned if the given key has non-null associated metadata. */
    readonly metadata?: Record<string, unknown>;
}

export interface KVListResult {
    /** An array of objects describing each key.
     * 
     * Keys are always returned in lexicographically sorted order according to their UTF-8 bytes. */
    readonly keys: KVListResultKey[];
}

export interface KVListCompleteResult extends KVListResult {

    /** No more keys to fetch. */
    // deno-lint-ignore camelcase
    readonly list_complete: true;
}

export interface KVListIncompleteResult extends KVListResult {

    /** If list_complete is false, there are more keys to fetch. */
    // deno-lint-ignore camelcase
    readonly list_complete: false;

    /** Used in subsequent list call. */
    readonly cursor: string;
}

export interface KVValueAndMetadata<T> {
    readonly metadata: Record<string, unknown> | null;
    readonly value: T;
}

export interface KVNamespace {

    // https://developers.cloudflare.com/workers/runtime-apis/kv#writing-key-value-pairs

    /** Creates a new key-value pair, or updates the value for a particular key.
     * 
     * This method returns a Promise that you should await on in order to verify a successful update.
     * 
     * The maximum size of a value is 25MB.
     * 
     * Due to the eventually consistent nature of Workers KV, concurrent writes from different edge locations can end up up overwriting one another. 
     * It’s a common pattern to write data via Wrangler or the API but read the data from within a worker, avoiding this issue by issuing all writes from the same location. 
     * 
     * Writes are immediately visible to other requests in the same edge location, but can take up to 60 seconds to be visible in other parts of the world. 
     */
    put(key: string, value: string | ReadableStream | ArrayBuffer, opts?: KVPutOptions): Promise<void>;

    // https://developers.cloudflare.com/workers/runtime-apis/kv#reading-key-value-pairs

    /** Returns a promise you can await to get the value. 
     * 
     * If the key is not found, the promise will resolve with the literal value null.
     * 
     * Note that get may return stale values -- if a given key has recently been read in a given location, 
     * changes to the key made in other locations may take up to 60 seconds to be visible. 
     * 
     * The type parameter can be any of: 
     *  - "text": (default) a string
     *  - "json": an object decoded from a JSON string
     *  - "arrayBuffer": An ArrayBuffer instance.
     *  - "stream": A ReadableStream.
     * 
     * For simple values it often makes sense to use the default "text" type which provides you with your value as a string. 
     * For convenience a "json" type is also specified which will convert a JSON value into an object before returning it to you. 
     * For large values you can request a ReadableStream, and for binary values an ArrayBuffer.
     * 
     * For large values, the choice of type can have a noticeable effect on latency and CPU usage. 
     * For reference, the types can be ordered from fastest to slowest as "stream", "arrayBuffer", "text", and "json". */
    get(key: string, opts?: KVGetOptions | { type: 'text' }): Promise<string | null>;
    get(key: string, opts: KVGetOptions | { type: 'json' }): Promise<Record<string, unknown> | null>;
    get(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
    get(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<ReadableStream | null>;

    // https://developers.cloudflare.com/workers/runtime-apis/kv#metadata-1

    /** Gets the metadata associated with a key-value pair alongside its value.
     * 
     * If there’s no metadata associated with the requested key-value pair, null will be returned for metadata. */
    getWithMetadata(key: string, opts?: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'json' }): Promise<KVValueAndMetadata<Record<string, unknown>> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<KVValueAndMetadata<ArrayBuffer> | null>;
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<KVValueAndMetadata<ReadableStream> | null>;

    // https://developers.cloudflare.com/workers/runtime-apis/kv#deleting-key-value-pairs
    
    /** Removes the key and value from your namespace. 
     * 
     * As with any operations, it may take some time to see that the key has been deleted from various points at the edge.
     * 
     * This method returns a promise that you should await on in order to verify successful deletion. */
    delete(key: string): Promise<void>;

    // https://developers.cloudflare.com/workers/runtime-apis/kv#listing-keys

    /** List all of the keys that live in a given namespace.
     * 
     * Changes may take up to 60 seconds to be visible when listing keys.
     */
    list(opts?: KVListOptions): Promise<KVListCompleteResult | KVListIncompleteResult>;
}

//#endregion

//#region Workers Cache https://developers.cloudflare.com/workers/runtime-apis/cache https://developers.cloudflare.com/workers/learning/how-the-cache-works

/**
 * The Cache API is available globally but the contents of the cache do not replicate outside of the originating data center.
 * 
 * Any Cache API operations in the Cloudflare Workers dashboard editor, Playground previews, and any *.workers.dev deployments will have no impact. 
 * Only Workers deployed to custom domains have access to functional Cache operations.
 */
export interface CfGlobalCaches {
    /**
     * The default cache (the same cache shared with fetch requests).
     * 
     * This is useful when needing to override content that is already cached, after receiving the response.
     * 
     * This affects your public cache.
     * 
     * Zone-level: it uses the same cache "namespace" as your zone (e.g. example.com)
     */
    readonly default: CfCache; // caches.default

    /**
     * A namespaced cache (separate from the cache shared with fetch requests).
     * 
     * This can be useful when writing new content to the cache, for example after running a more compute heavy operation such as parsing HTML or running a computation, 
     * to store them locally in the colo and readily access them on the following request, rather having to rerun the same operation.
     * 
     * The public cannot access this (unless you let them through your Worker).
     * 
     * Account-level: two different workers can access the same cache using the same name!  They will be accessing the same namespace.
     */
    open(cacheName: string): Promise<CfCache>;
}

export interface CfCacheOptions {
    /** Consider the request method a GET regardless of its actual value. */
    readonly ignoreMethod?: boolean;
}

export interface CfCache {
    
    /** Adds to the cache a response keyed to the given request. 
     * 
     * Returns a promise that resolves to undefined once the cache stores the response.
     * 
     * @param request Either a string or a Request object to serve as the key. If a string is passed, it is interpreted as the URL for a new Request object.
     * @param response A Response object to store under the given key.
     * 
     * @throws if the request passed is a method other than GET
     * @throws if the response passed is a status of 206 Partial Content
     * @throws if the response passed contains the header Vary: * (required by the Cache API specification)
     * */
    put(request: string | Request, response: Response): Promise<undefined>;

    /** Returns a promise wrapping the response object keyed to that request.
     * 
     *  Never sends a subrequest to the origin. If no matching response is found in cache, the promise that cache.match() returns is fulfilled with undefined.
     * 
     * @param request The string or Request object used as the lookup key. Strings are interpreted as the URL for a new Request object.
     */
    match(request: string | Request, opts?: CfCacheOptions): Promise<Response | undefined>;

    /** Deletes the Response object from the cache and returns a Promise for a Boolean response:
     * 
     * true: The response was cached but is now deleted
     * false: The response was not in the cache at the time of deletion. 
     * 
     * @param request The string or Request object used as the lookup key. Strings are interpreted as the URL for a new Request object.
     * */
    delete(request: string | Request, opts?: CfCacheOptions): Promise<boolean>;
}

//#endregion

//#region Accessing a Durable Object from a Worker 

// https://developers.cloudflare.com/workers/runtime-apis/durable-objects#accessing-a-durable-object-from-a-worker

/** The Durable Object namespace is configured to use a particular class, and controls access to instances of that class. */
export interface DurableObjectNamespace {
    /** Creates a new object ID randomly. 
     * 
     * This method will never return the same ID twice, and thus it is guaranteed that the object does not yet exist and has never existed at the time the method returns.
     * 
     * https://developers.cloudflare.com/workers/runtime-apis/durable-objects#generating-ids-randomly
     *  */
    newUniqueId(opts?: { jurisdiction: Jurisdiction }): DurableObjectId;

    /** This method derives a unique object ID from the given name string. 
     * 
     * It will always return the same ID when given the same name as input. 
     * 
     * https://developers.cloudflare.com/workers/runtime-apis/durable-objects#deriving-ids-from-names
     *  */
    idFromName(name: string): DurableObjectId;

    /** This method parses an ID that was previously stringified. 
     * 
     * This is useful in particular with IDs created using newUniqueId(), as these IDs need to be stored somewhere, probably as as a string. 
     * 
     * A stringified object ID is a 64-digit hexadecimal number. However, not all 64-digit hex numbers are valid IDs. 
     * 
     * This method will throw if it is passed an ID that was not originally created by newUniqueId() or idFromName(). 
     * 
     * It will also throw if the ID was originally created for a different namespace. 
     * 
     * https://developers.cloudflare.com/workers/runtime-apis/durable-objects#parsing-previously-created-ids-from-strings
     * */
    idFromString(hexStr: string): DurableObjectId;

    /** This method constructs an object "stub", which is a local client that provides access to a remote Durable Object. 
     * 
     * If the remote object does not already exist, it will be created. 
     * 
     * Thus, there will always be something for the stub to talk to. 
     * 
     * This method always returns the stub immediately, before it has connected to the remote object. 
     * 
     * This allows you to begin making requests to the object right away, without waiting for a network round trip. 
     * 
     * Durable Objects don't currently move between geographical regions after they are created (dynamic relocation of existing Durable Objects is planned for the future). 
     * By default they are created close to the first client that accesses them via `get`.
     *
     * If you'd like to manually create them in another location, you can provide an optional `locationHint` parameter to `get`. 
     * Only the first call to `get` for a particular object will respect the hint.
     *
     * The following `locationHint`s are supported. Note that hints are a best effort and not a guarantee. Durable Objects do not currently run in all of the locations below, and so the closest nearby region will be used until those locations are fully supported.
     *
     * | Location Hint Parameter  | Location              |
     * | ------------------------ | --------------------- |
     * | wnam                     | Western North America |
     * | enam                     | Eastern North America |
     * | sam                      | South America         |
     * | weur                     | Western Europe        |
     * | eeur                     | Eastern Europe        |
     * | apac                     | Asia-Pacific          |
     * | oc                       | Oceania               |
     * | afr                      | Africa                |
     * | me                       | Middle East           |
     *
     * https://developers.cloudflare.com/workers/runtime-apis/durable-objects#obtaining-an-object-stub
     * */
    get(id: DurableObjectId, opts?: { locationHint?: LocationHint }): DurableObjectStub;

    /** This method obtains a DurableObjectStub from a provided name, which can be used to invoke methods on a Durable Object.
     * 
     * Convenience for calling .idFromName, then .get
     */
    getByName(name: string, opts?: { locationHint?: LocationHint }): DurableObjectStub;

    /** Creates a subnamespace from a namespace where all Durable Object IDs and references created from that subnamespace will be restricted to the specified jurisdiction. */
    jurisdiction(jurisdiction: Jurisdiction): DurableObjectNamespace;
}

export type LocationHint = 'wnam' | 'enam' | 'sam' | 'weur' | 'eeur' | 'apac' | 'oc' | 'afr' | 'me';

export type Jurisdiction = 'eu' | 'fedramp' | 'fedramp-high';

// https://developers.cloudflare.com/workers/runtime-apis/durable-objects#obtaining-an-object-stub

/** A Durable Object stub is a client object used to send requests to a remote Durable Object.
 * 
 * Stubs implement E-order semantics. When you make multiple calls to the same stub, it is guaranteed that the calls will be delivered 
 * to the remote object in the order in which you made them. This ordering guarantee often makes many distributed programming problems easier. 
 * However, there is a cost: due to random network disruptions or other transient issues, a stub may become disconnected from its remote object. 
 * Once a stub is disconnected, it is permanently broken, and all in-flight calls and future calls will fail with exceptions. 
 * In order to make new requests to the Durable Object, you must call OBJECT_NAMESPACE.get(id) again to get a new stub, 
 * and you must keep in mind that there are no ordering guarantees between requests to the new stub vs. the old one. 
 * If you don't care about ordering at all, you can create a new stub for every request.
 */
 export interface DurableObjectStub {
    /** The fetch() method of a stub has the exact same signature as the global fetch. 
     * 
     * However, instead of sending an HTTP request to the internet, the request is always sent to the Durable Object to which the stub points.
     * 
     * Any uncaught exceptions thrown by the Durable Object's fetch() handler are propagated to the caller's fetch() promise. */
    fetch(url: RequestInfo, init?: RequestInit): Promise<Response>;
}

// https://developers.cloudflare.com/workers/runtime-apis/durable-objects#generating-ids-randomly
export interface DurableObjectId {
    toString(): string;
}

//#endregion

//#region Durable Object implementation types

export type DurableObjectStorageValue = number | string | object;  // add more as necessary ("The value can be any type supported by the structured clone algorithm, which is true of most types.")

export interface DurableObjectStorageMethods {
    /** Retrieves the value associated with the given key. 
     * 
     * The type of the returned value will be whatever was previously written for the key, or undefined if the key does not exist. */
    get(key: string, opts?: DurableObjectStorageReadOptions): Promise<DurableObjectStorageValue | undefined>;

    /** Retrieves the values associated with each of the provided keys. 
     * 
     * The type of each returned value in the Map will be whatever was previously written for the corresponding key. 
     * Any keys that do not exist will be omitted from the result Map. 
     * 
     * Supports up to 128 keys at a time. */
    get(keys: readonly string[], opts?: DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;

    /** Stores the value and associates it with the given key. 
     * 
     * The value can be any type supported by the structured clone algorithm, which is true of most types. 
     * 
     * Keys are limited to a max size of 2048 bytes and values are limited to 32 KiB (32768 bytes). 
     * 
     * */
    put(key: string, value: DurableObjectStorageValue, opts?: DurableObjectStorageWriteOptions): Promise<void>;

    /** Takes an Object and stores each of its keys and values to storage. 
     * 
     * Each value can be any type supported by the structured clone algorithm, which is true of most types. 
     * 
     * Supports up to 128 key-value pairs at a time. 
     * 
     * Each key is limited to a max size of 2048 bytes and each value is limited to 32 KiB (32768 bytes). */
    put(entries: Record<string, unknown>, opts?: DurableObjectStorageWriteOptions): Promise<void>;

    /** Deletes the key and associated value.
     * 
     * Returns true if the key existed or false if it didn't. */
    delete(key: string, opts?: DurableObjectStorageWriteOptions): Promise<boolean>;

    /** Deletes the provided keys and their associated values. 
     * 
     * Returns a count of the number of key-value pairs deleted. */
    delete(keys: readonly string[], opts?: DurableObjectStorageWriteOptions): Promise<number>;

    /** Returns all keys and values associated with the current Durable Object in ascending lexicographic sorted order. 
     * 
     * The type of each returned value in the Map will be whatever was previously written for the corresponding key. 
     * 
     * Be aware of how much data may be stored in your actor before calling this version of list without options, 
     * because it will all be loaded into the Durable Object's memory, potentially hitting its [limit](https://developers.cloudflare.com/workers/platform/limits). 
     * 
     * If that is a concern, pass options to list as documented below. */
    list(): Promise<Map<string, DurableObjectStorageValue>>;

    /** Returns keys associated with the current Durable Object according to the parameters in the provided DurableObjectStorageListOptions object. */
    list(options: DurableObjectStorageListOptions & DurableObjectStorageReadOptions): Promise<Map<string, DurableObjectStorageValue>>;

    /** Retrieves the current alarm time (if set) as integer milliseconds since epoch. 
     * 
     * The alarm is considered to be set if it has not started, or if it has failed and any retry has not begun.
     * 
     * If no alarm is set, getAlarm() returns null. */
    getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null>;

    /** Sets the current alarm time, accepting either a JS Date, or integer milliseconds since epoch.
     * 
     * If setAlarm() is called with a time equal to or before Date.now(), the alarm will be scheduled for asynchronous execution in the immediate future. 
     * 
     * If the alarm handler is currently executing in this case, it will not be canceled.
     * 
     * Alarms can be set to millisecond granularity and will usually execute within a few milliseconds after the set time, 
     * but can be delayed by up to a minute due to maintenance or failures while failover takes place. */
    setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void>;

    /** Deletes the alarm if one exists.
     * 
     * Does not cancel the alarm handler if it is currently executing. */
    deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void>;
}

export interface DurableObjectStorage extends DurableObjectStorageMethods {
    // https://developers.cloudflare.com/workers/runtime-apis/durable-objects#methods

    /** Runs the sequence of storage operations called on txn in a single transaction that either commits successfully or aborts. 
     * 
     * Failed transactions are retried automatically. 
     * 
     * Non-storage operations that affect external state, like calling fetch, may execute more than once if the transaction is retried.
     * 
     * The closure can return a value, which will be propagated as the return value of the call. */
    transaction<T>(closure: (txn: DurableObjectStorageTransaction) => T | PromiseLike<T>): Promise<T>;

    /** Deletes all keys and associated values, effectively deallocating all storage used by the worker. 
     * 
     * Once deleteAll() has been called, no subsequent Durable Storage operations (including transactions and operations on transactions) may be executed 
     * until after the deleteAll() operation completes and the returned promise resolves. 
     * 
     * In the event of a failure while the deleteAll() operation is still in flight, it may be that only a subset of the data is properly deleted. */
    deleteAll(): Promise<void>;

    /** Synchronizes any pending writes to disk.
     * 
     * This is similar to normal behavior from automatic write coalescing. If there are any pending writes in the write buffer (including those submitted with allowUnconfirmed),
     * the returned promise will resolve when they complete. If there are no pending writes, the returned promise will be already resolved. */
    sync(): Promise<void>;

    /** Use SQLite in Durable Objects.
     * 
     * SQL API methods accessed with .sql are only allowed on Durable Object classes with SQLite storage backend and will return an error if called on Durable Object classes with a key-value storage backend. */
    get sql(): SqlStorage;

    /** Similar to .transaction, but not async */
    transactionSync<T>(closure: () => T): T;

    /** Returns a bookmark representing the current point in time in the object’s history */
    getCurrentBookmark(): Promise<string>;

    /** Returns a bookmark representing approximately the given point in time, which must be within the last 30 days. */
    getBookmarkForTime(timestamp: number | Date): Promise<string>;

    /** Configure the Durable Object so that the next time it restarts, it should restore its storage to exactly match what the storage contained at the given bookmark.
     * 
     * After calling this, the application should typically invoke state.abort() to restart the Durable Object, thus completing the point-in-time recovery. */
    onNextSessionRestoreBookmark(bookmark: string): Promise<string>;
}

export interface SqlStorage {
    /** Execute one or more sql queries.
     * 
     * `query` can contain ? placeholders for parameter bindings.
     * 
     * Multiple SQL statements, separated with a semicolon, can be executed in the query.
     * 
     * With multiple SQL statements, any parameter bindings are applied to the last SQL statement in the query, and the returned cursor is only for the last SQL statement. */
    // deno-lint-ignore no-explicit-any
    exec<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: any[]): SqlStorageCursor<T>;

    /** The current SQLite database size in bytes. */
    get databaseSize(): number;
}

export type SqlStorageValue = ArrayBuffer | string | number | null;

export interface SqlStorageCursor<T extends Record<string, SqlStorageValue>> {
    /** Returns an object representing the next value of the cursor.
     * 
     * The returned object has done and value properties adhering to the JavaScript Iterator.
     * 
     * `done` is set to false when a next value is present, and `value` is set to the next row object in the query result.
     * `done` is set to true when the entire cursor is consumed, and no `value` is set. */
    next(): { done?: false, value: T } | { done: true, value?: never };

    /** Iterates through remaining cursor value(s) and returns an array of returned row objects. */
    toArray(): T[];

    /** Returns a row object if query result has exactly one row. If query result has zero rows or more than one row, one() throws an exception. */
    one(): T;

    /** Returns an Iterator over the same query results, with each row as an array of column values (with no column names) rather than an object.
     * 
     * Returned Iterator supports next(), toArray(), and one() methods above.
     * 
     * Returned cursor and raw() iterator iterate over the same query results and can be combined. */
    raw<U extends SqlStorageValue[]>(): IterableIterator<U> & { toArray(): U[] };

    /** The column names of the query in the order they appear in each row array returned by the raw iterator. */
    get columnNames(): string[];

    /** The number of rows read so far as part of this SQL query. This may increase as you iterate the cursor. The final value is used for SQL billing. */
    get rowsRead(): number;

    /** The number of rows written so far as part of this SQL query. This may increase as you iterate the cursor. The final value is used for SQL billing. */
    get rowsWritten(): number;

    [Symbol.iterator](): IterableIterator<T>;
}

/** Provides access to the put(), get(), delete() and list() methods documented above to run in the current transaction context. 
 * 
 * In order to get transactional behavior within a transaction closure, you must call the methods on the txn object instead of on the top-level state.storage object.
 * 
 * Also supports a rollback() function that ensures any changes made during the transaction will be rolled back rather than committed. 
 * 
 * After rollback() is called, any subsequent operations on the txn object will fail with an exception. 
 * 
 * rollback() takes no parameters and returns nothing to the caller. */
export interface DurableObjectStorageTransaction extends DurableObjectStorageMethods {
    rollback(): void;
}

export interface DurableObjectStorageReadOptions {
    /** Bypass the built-in concurrency gates */
    readonly allowConcurrency?: boolean;

    /** Bypass the built-in memory cache */
    readonly noCache?: boolean;
}

export interface DurableObjectGetAlarmOptions {

    // see DurableObjectStorageReadOptions
    readonly allowConcurrency?: boolean;
}

export interface DurableObjectStorageWriteOptions {
    /** Bypass the built-in waiting for write to complete before returning a response
     * 
    * With the new storage memory cache in place, if you don't await a `put()`, it will now implicitly await it before returning a response, 
    * to avoid premature confirmation of writes. But if you actually don't want to wait, and you are OK with the possibility of rare data loss 
    * (e.g. if the power went out before the write completed), then you should use `{ allowUnconfirmed: true }` */
    readonly allowUnconfirmed?: boolean;

    /** Bypass the built-in memory cache */
    readonly noCache?: boolean;
}

export interface DurableObjectSetAlarmOptions {

    // see DurableObjectStorageWriteOptions
    readonly allowUnconfirmed?: boolean;
}

export interface DurableObjectStorageListOptions {
    /** Key at which the list results should start, inclusive. */
    readonly start?: string;

    /** Key after which the list results should start, exclusive. Cannot be used simultaneously with 'start'. */
    readonly startAfter?: string;

    /** Key at which the list results should end, exclusive. */
    readonly end?: string;

    /** Restricts results to only include key-value pairs whose keys begin with the prefix. */
    readonly prefix?: string;

    /** If true, return results in descending lexicographic order instead of the default ascending order. */
    readonly reverse?: boolean;

    /** Maximum number of key-value pairs to return.  */
    readonly limit?: number;
}

/** Passed from the runtime to provide access to the Durable Object's storage as well as various metadata about the Object.  */
export interface DurableObjectState {
    /** The ID of this Durable Object. 
     * 
     * It can be converted into a hex string using its .toString() method. */
    readonly id: DurableObjectId;

    /** Contains methods for accessing persistent storage via the transactional storage API. 
     * 
     * See Transactional Storage API for a detailed reference. */
    readonly storage: DurableObjectStorage;

    readonly container?: DurableObjectContainer;

    /** Notifies the runtime to wait for the completion of asynchronous tasks that may complete after a response has already been sent. 
     * 
     * See [waitUntil()](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil) for a detailed reference. */
    waitUntil(promise: Promise<unknown>): void;

    /** Useful for delaying delivery of requests and other events while performing some critical state-affecting task. 
     * 
     * For example, this can be used to perform start-up initialization in an object’s constructor. */
    blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;

    /** Adds a WebSocket to the set attached to this Durable Object. */
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;

    /** Gets an array of accepted WebSockets matching the given tag. */
    getWebSockets(tag?: string): WebSocket[];

    /** Sets an application level auto response that does not wake hibernated WebSockets */
    setWebSocketAutoResponse(maybeReqResp?: WebSocketRequestResponsePair): void;

    /** Gets the WebSocketRequestResponsePair(request, response) currently set, or null if there is none. */
    getWebSocketAutoResponse(): WebSocketRequestResponsePair | null;

    /** Gets the most recent Date when the WebSocket received an auto-response request, or null if the given WebSocket never received an auto-response request. */
    getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null;

    /** Sets or unsets the timeout for hibernatable websocket events, preventing the execution of the event from taking longer than the specified timeout, if set.
     * 
     * https://github.com/cloudflare/workerd/blob/3c85053b83a5200dffc5be5ae26cbe7577cd5ea5/src/workerd/api/actor-state.h#L468
     */
    setHibernatableWebSocketEventTimeout(timeoutMs?: number): void;

    /** Get the currently set hibernatable websocket event timeout if set. */
    getHibernatableWebSocketEventTimeout(): number | null;

    /** Gets an array of tags that this websocket was accepted with. If the given websocket is not hibernatable, we'll throw an error because regular websockets do not have tags. */
    getTags(ws: WebSocket): string[];

    /** Forcibly reset a Durable Object.
     * 
     * A JavaScript Error with the message passed as a parameter will be logged. This error is not able to be caught within the application code. */
    abort(reason?: string): void;
}

export interface DurableObjectContainer {
    /** True if the container is currently running.
     * 
     * It does not ensure that the container has fully started and ready to accept requests. */
    get running(): boolean;

    /** Boots a container.
     * 
     * This method does not block until the container is fully started. You may want to confirm the container is ready to accept requests before using it. */
    start(options?: { entrypoint?: string[], enableInternet?: boolean, env?: Record<string, string> }): void;

    /** Returns a promise that resolves when a container exits and errors if a container errors.
     * 
     * This is useful for setting up callbacks to handle container status changes in your Workers code.
     * @returns a promise that resolves when the container exits.
     * 
     * */
    monitor(): Promise<void>;

    /** Stops the container and optionally returns a custom error message to the monitor() error callback.
     * 
     * @returns a promise that returns once the container is destroyed.
    */
    destroy(error?: unknown): Promise<void>;

    /** Sends an IPC signal to the container, such as SIGKILL (15) or SIGTERM (9).
     * 
     * This is useful for stopping the container gracefully or forcefully. */
    signal(signo: number): void;

    /** Returns a TCP port from the container.
     * 
     * This can be used to communicate with the container over TCP and HTTP. */
    getTcpPort(port: number): CloudflareFetcher;
}

export interface CloudflareSockets {
    connect(address: SocketAddress | string, options?: SocketOptions): Socket;
}

export type CloudflareFetcher = { fetch: typeof fetch } & CloudflareSockets;

export interface SocketAddress {
    /** The hostname to connect to. Example: cloudflare.com */
    readonly hostname: string;

    /** The port number to connect to. Example: 5432  */
    readonly port: number;
}

export interface SocketOptions {
    /** Specifies whether or not to use TLS when creating the TCP socket. Defaults to off */
    readonly secureTransport?: 'off' | 'on' | 'starttls';

    /** Defines whether the writable side of the TCP socket will automatically close on end-of-file (EOF).
     * 
     * When set to false, the writable side of the TCP socket will automatically close on EOF. When set to true, the writable side of the TCP socket will remain open on EOF.*/
    readonly allowHalfOpen?: boolean;
}

export interface Socket {

    /** Returns the readable side of the TCP socket. */
    readonly readable: ReadableStream<Uint8Array>;

    /** Returns the writable side of the TCP socket. */
    readonly writable: WritableStream<Uint8Array>;

    /** This promise is resolved when the socket is closed and is rejected if the socket encounters an error. */
    readonly closed: Promise<void>;

    /** Closes the TCP socket. Both the readable and writable streams are forcibly closed. */
    close(): Promise<void>;

    /** Upgrades an insecure socket to a secure one that uses TLS, returning a new Socket.
     * 
     * Note that in order to call startTls(), you must set secureTransport to starttls when initially calling connect() to create the socket. */
    startTls(): Socket;
}

declare class WebSocketRequestResponsePair {
    constructor(request: string, response: string);
    get request(): string;
    get response(): string;
}

// https://developers.cloudflare.com/durable-objects/api/websockets/#handler-methods
export interface DurableObjectHibernatableWebSocketsHandlers {
    /** Called by the system when an accepted WebSocket receives a message.
     * 
     * This method is not called for WebSocket control frames. The system will respond to an incoming WebSocket protocol ping automatically without interrupting hibernation. */
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;

    /** Called by the system when a WebSocket is closed. wasClean() is true if the connection closed cleanly, false otherwise. */
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>;

    /** Called by the system when any non-disconnection related errors occur. */
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
}

/** Non-standard additions to WebSocket in durable objects */
export interface CloudflareDurableObjectWebSocketExtensions {
    /** Keeps a copy of value in memory (not on disk) to survive hibernation. The value can be any type supported by the structured clone algorithm, which is true of most types.
     * 
     * If you modify value after calling this method, those changes will not be retained unless you call this method again.
     * The serialized size of value is limited to 2,048 bytes, otherwise this method will throw an error.
     * If you need larger values to survive hibernation, use the Transactional Storage API and pass the corresponding key to this method so it can be retrieved later. */
    // deno-lint-ignore no-explicit-any
    serializeAttachment(attachment: any): void;

    /** Retrieves the most recent value passed to serializeAttachment(), or null if none exists. */
    // deno-lint-ignore no-explicit-any
    deserializeAttachment(): any | null;
}

//#endregion

//#region WebSockets

export interface CloudflareWebSocketExtensions {
    /** Accepts the Websocket connection and begins terminating requests for the WebSocket at Cloudflare's edge. 
     * This effectively enables the Workers runtime to begin responding to and handling WebSocket requests. 
     * 
     * https://developers.cloudflare.com/workers/runtime-apis/websockets#accept
     * */
    accept(): void;
    
    /**
     * Cloudflare-specific behavior:
     * 
     * readyState is not implemented (and associated WebSocket.CONNECTED, CONNECTING etc), by the time you get it, it's already in the OPEN state
     * 
     * send() may throw:
     *  - if accept() hasn't been called
     *  - if close() has already been called
     *  - if onerror has fired.
     *  - Otherwise, it adds the message to a send queue, which shouldn't ever throw
     *  - send() doesn't care if onclose has occurred since they represent opposite directions of the stream.
     */
}

export interface CloudflareResponseInitExtensions {
    webSocket?: WebSocket & CloudflareWebSocketExtensions;
}

// non-standard class, only on CF
export interface WebSocketPair {
    readonly 0: WebSocket; // client, returned in the ResponseInit
    readonly 1: WebSocket & CloudflareWebSocketExtensions; // server, accept(), addEventListener(), send() and close()
}

//#endregion

//#region R2

export interface R2Bucket {
    head(key: string): Promise<R2Object | null>;
    get(key: string): Promise<R2ObjectBody | null>;
    get(key: string, options: R2GetOptions): Promise<R2ObjectBody | R2Object | null>;
    put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
    delete(keys: string | string[]): Promise<void>;
    list(options?: R2ListOptions): Promise<R2Objects>;
    createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>;
    resumeMultipartUpload(key: string, uploadId: string): Promise<R2MultipartUpload>;
}

export interface R2MultipartOptions {
    readonly httpMetadata?: R2HTTPMetadata | Headers;
    readonly customMetadata?: Record<string, string>;
}

export interface R2MultipartUpload {
    readonly key: string;
    readonly uploadId: string;

    uploadPart(partNumber: number, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob): Promise<R2UploadedPart>;
    abort(): Promise<void>;
    complete(uploadedParts: R2UploadedPart[]): Promise<R2Object>;
}

export interface R2UploadedPart {
    readonly partNumber: number;
    readonly etag: string;
}

export interface R2Conditional {
    readonly etagMatches?: string;
    readonly etagDoesNotMatch?: string;
    readonly uploadedBefore?: Date;
    readonly uploadedAfter?: Date;
}

export interface R2GetOptions {
    readonly onlyIf?: R2Conditional | Headers;
    readonly range?: R2Range;
}

export interface R2HTTPMetadata {
    readonly contentType?: string;
    readonly contentLanguage?: string;
    readonly contentDisposition?: string;
    readonly contentEncoding?: string;
    readonly cacheControl?: string;
    readonly cacheExpiry?: Date;
}

export interface R2ListOptions {
    readonly limit?: number;
    readonly prefix?: string;
    readonly cursor?: string;
    readonly delimiter?: string;
    readonly startAfter?: string;
    readonly include?: ('httpMetadata' | 'customMetadata')[];
}

export interface R2Object {
    readonly key: string;
    readonly version: string;
    readonly size: number;
    readonly etag: string;
    readonly httpEtag: string;
    readonly checksums: R2Checksums;
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;
    readonly range?: R2Range;
    writeHttpMetadata(headers: Headers): void;
}

export interface R2Checksums {
    readonly md5?: ArrayBuffer;
    readonly sha1?: ArrayBuffer;
    readonly sha256?: ArrayBuffer;
    readonly sha384?: ArrayBuffer;
    readonly sha512?: ArrayBuffer;
}

export interface R2ObjectBody extends R2Object {
    readonly body: ReadableStream;
    readonly bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json<T>(): Promise<T>;
    blob(): Promise<Blob>;
}

export interface R2Objects {
    readonly objects: R2Object[];
    readonly truncated: boolean;
    readonly cursor?: string;
    readonly delimitedPrefixes: string[];
}

export interface R2PutOptions {
    readonly onlyIf?: R2Conditional | Headers;
    readonly httpMetadata?: R2HTTPMetadata | Headers;
    readonly customMetadata?: Record<string, string>;
    readonly md5?: ArrayBuffer | string; // hex if string
    readonly sha1?: ArrayBuffer | string;
    readonly sha256?: ArrayBuffer | string;
    readonly sha384?: ArrayBuffer | string;
    readonly sha512?: ArrayBuffer | string;
}

export type R2Range =
  | { offset: number; length?: number }
  | { offset?: number; length: number }
  | { suffix: number };

//#endregion

//#region Analytics Engine

export interface AnalyticsEngine {
    // limit of 25 writes (writeDataPoint invocations) per client HTTP request
    writeDataPoint(event: AnalyticsEngineEvent): void;
}
  
export interface AnalyticsEngineEvent {
    readonly doubles?: number[]; // up to 20
    readonly blobs?: (ArrayBuffer | string | null)[]; // up to 20, max sum of all blobs: 5kb
    readonly indexes?: string[]; // 0 or 1, max 96 bytes
}

//#endregion

//#region D1

export interface D1Database {

    /** Create a precompiled query statement.
     * 
     * Prepared statements lead to overall faster execution and prevent SQL injection attacks. */
    prepare(query: string): D1PreparedStatement;

    /** (deprecated: alpha) Dumps the entire D1 database to an SQLite compatible file inside an ArrayBuffer. */
    dump(): Promise<ArrayBuffer>;

    /** Execute a list of prepared statements and get the results in the same order.
     * 
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#dbbatch
     */
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;

    /** Executes one or more queries directly without prepared statements or parameters binding.
     * 
     * This method can have poorer performance (prepared statements can be reused in some cases) and, more importantly, is less safe.
     * Only use this method for maintenance and one-shot tasks (for example, migration jobs).
     * 
     * The input can be one or multiple queries separated by \n.
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#await-dbexec
     */
    exec(query: string): Promise<D1ExecResult>;
}


export interface D1ExecResult {
    readonly count: number;
    readonly duration: number;
}

export interface D1PreparedStatement {

    /** Bind positional parameters to values.
     * 
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#parameter-binding
     */
    bind(...values: unknown[]): D1PreparedStatement;

    /** Returns the first row of the results, optionally limited to a single column.
     * 
     * This does not return metadata like the other methods. Instead it returns the object directly.
     * 
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#await-stmtfirstcolumn
     */
    first<T = unknown>(column: string): Promise<T | null>;
    first<T = Record<string, unknown>>(): Promise<T | null>;

    /** Returns all rows as an array of objects, with each result row represented as an object on the results property of the D1Result type.
     * 
     * Includes query metadata.
     * 
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#await-stmtall
     */
    all<T = Record<string, unknown>>(): Promise<D1Result<T>>;

    /** Returns results as an array of arrays, with each row represented by an array.
     * 
     * The return type is an array of column and value arrays, and does not include query metadata.
     * 
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#await-stmtraw
     */
    raw<T = unknown[]>(options: { columnNames: true }): Promise<[ string[], ...T[] ]>;
    raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;

    /** Runs the query (or queries) and returns results.
     * 
     * Returns all rows as an array of objects, with each result row represented as an object on the results property of the D1Result type.
     * 
     * For write operations like UPDATE, DELETE or INSERT, results will be empty. 
     * 
     * Run is functionally equivalent to stmt.all() and can be treated as an alias.
     * 
     * https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#await-stmtrun
     */
    run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
    
}

export interface D1QueryMetadata {
    readonly served_by?: string; // e.g. v3-prod
    readonly duration: number; // duration of the operation in milliseconds, e.g. 0.04996099999999615
    readonly last_row_id: number; // the rowid of the last row inserted or null if it doesn't apply, see https://www.sqlite.org/c3ref/last_insert_rowid.html
    readonly changes: number; // total # of rows that were inserted/updated/deleted, or 0 if read-only
    readonly changed_db: boolean;
    readonly size_after: number; // in bytes
    readonly rows_read: number; // the number of rows read (scanned) by this query
    readonly rows_written: number; // the number of rows written by this query
}

export interface D1Result<T = unknown> {
    readonly results: T[];
    readonly meta: D1QueryMetadata & Record<string, unknown>;
    readonly success: boolean; // always true, now throws on errors
}

//#endregion

//#region Queues

export type QueuesContentType = 'text' | 'bytes' | 'json' | 'v8';

export interface Queue {

    /** Sends a message to the Queue. 
     * 
     * The message can be any type supported by the structured clone algorithm, as long as its size is less than 128 KB.
     * When the promise resolves, the message is confirmed to be written to disk.
     * 
     * - Use "text" to send a String. This content type can be previewed with the List messages from the dashboard feature.
     * - Use "json" to send a JavaScript object that can be JSON-serialized. This content type can be previewed from the Cloudflare dashboard.
     * - Use "bytes" to send an ArrayBuffer. This content type cannot be previewed from the Cloudflare dashboard and will display as Base64-encoded.
     * - Use "v8" to send a JavaScript object that cannot be JSON-serialized but is supported by structured clone (for example Date and Map). This content type cannot be previewed from the Cloudflare dashboard and will display as Base64-encoded.
     * 
     * "v8" is the default content type.
     * */
    send(message: unknown, opts?: { contentType?: QueuesContentType }): Promise<void>;

    /** Sends multiple messages to the Queue. */
    sendBatch(messages: Iterable<{ body: unknown, contentType?: QueuesContentType }>): Promise<void>;
}

/** A message that is sent to a consumer Worker. */
export interface QueueMessage {

    /** A unique, system-generated ID for the message. */
    readonly id: string;

    /** A timestamp when the message was sent. */
    readonly timestamp: Date;

    /** The body of the message.
     * 
     * The body can be any type supported by the structured clone algorithm, as long as its size is less than 128 KB.
    */
    readonly body: unknown;

    /** The number of delivery attempts made. */
    readonly attempts: number;

    /** Marks a message as successfully delivered, regardless of whether your queue() consumer handler returns successfully or not. */
    ack(): void;

    /** Marks a message to be retried in the next batch. */
    retry(opts?: QueueRetryOpts): void;
}

export interface QueueRetryOpts {
    /** Retry the message or batch after a specified number of seconds. */
    readonly delaySeconds?: number;
}

/** A batch of messages that are sent to a consumer Worker. */
export interface QueueMessageBatch {
    /** The name of the Queue that belongs to this batch. */
    readonly queue: string;

    /** An array of messages in the batch. Ordering of messages is best effort – not guaranteed to be exactly the same as the order in which they were published. */
    readonly messages: readonly QueueMessage[];

    /** Marks every message to be retried in the next batch. */
    retryAll(opts?: QueueRetryOpts): void;

    /** Marks every message as successfully delivered, regardless of whether your queue() consumer handler returns successfully or not. */
    ackAll(): void;
}

//#endregion

//#region Hyperdrive

export interface Hyperdrive {
    /** Full connection string to the internal hyperdrive db endpoint (only works inside workers), _not_ the origin db */
    readonly connectionString: string; // e.g. postgresql://<username-id>:<password-id>@<subdomain-id>.hyperdrive.local:5432/<hyperdrive-config-id>?sslmode=disable

    /** Hyperdrive db port */
    readonly port: number;

    /** Hyperdrive db host */
    readonly host: string;

    /** Hyperdrive db host */
    readonly password: string;

    /** Hyperdrive db user */
    readonly user: string;

    /** Hyperdrive db database name */
    readonly database: string;
}

//#endregion

//#region AI

// https://developers.cloudflare.com/workers-ai/models/text-generation/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Ftext-generation.d.ts
export type AiTextGenerationInput = ({ prompt: string } | { messages: { role: string, content: string }[] }) & { raw?: boolean, stream?: boolean, max_tokens?: number };
export type AiTextGenerationOutput = { response: string } | ReadableStream;

// https://developers.cloudflare.com/workers-ai/models/translation/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Ftranslation.d.ts
export type AiTranslationInput = { text: string, target_lang: string, source_lang?: string };
export type AiTranslationOutput = { translated_text: string };

// https://developers.cloudflare.com/workers-ai/models/text-classification/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Ftext-classification.d.ts
export type AiTextClassificationInput = { text: string };
export type AiTextClassificationOutput = { label?: string /* NEGATIVE or POSITIVE */, score?: number /* 0 to 1 */ }[];

// https://developers.cloudflare.com/workers-ai/models/text-embeddings/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Ftext-embeddings.d.ts
export type AiTextEmbeddingsInput = { text: string | string[] };
export type AiTextEmbeddingsOutput = { shape: number[], data: number[][] };

// https://developers.cloudflare.com/workers-ai/models/image-classification/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Fimage-classification.d.ts
export type AiImageClassificationInput = { image: number[] }; // byte array
export type AiImageClassificationOutput = { label?: string /* EGYPTIAN CAT */, score?: number /* 0 to 1 */ }[];

// https://developers.cloudflare.com/workers-ai/models/speech-recognition/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Fspeech-recognition.d.ts
export type AiSpeechRecognitionInput = { audio: number[] }; // byte array
export type AiSpeechRecognitionOutput = { text: string, word_count?: number, words?: { word: string, start: number, end: number }[] };

// https://developers.cloudflare.com/workers-ai/models/text-to-image/
// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Ftext-to-image.d.ts
export type AiTextToImageInput = { prompt: string, num_steps?: number, image?: number[], mask?: number[], strength?: number, guidance?: number };
export type AiTextToImageOutput = Uint8Array /* png bytes */;

// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Fobject-detection.d.ts
export type AiObjectDetectionInput = { image: number[] }; // byte array
export type AiObjectDetectionOutput = { score: number, label: string, box: { xmin: number, ymin: number, xmax: number, ymax: number } }[];

// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Fsentence-similarity.d.ts
export type AiSentenceSimilarityInput = { source: string, sentences: string[] };
export type AiSentenceSimilarityOutput = number[]; // TODO review once seen

// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Fsummarization.d.ts
export type AiSummarizationInput = { input_text: string, max_length?: number };
export type AiSummarizationOutput = { summary: string };

// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Ftasks%2Fimage-to-text.d.ts
export type AiImageToTextInput = { image: number[], prompt?: string, max_tokens?: number };
export type AiImageToTextOutput = { description: string };

export type AiModelInput = AiTextGenerationInput | AiTranslationInput | AiTextClassificationInput | AiTextEmbeddingsInput | AiImageClassificationInput | AiSpeechRecognitionInput | AiTextToImageInput | AiObjectDetectionInput | AiSentenceSimilarityInput | AiSummarizationInput | AiImageToTextInput | Record<string, unknown>;
export type AiModelOutput = AiTextGenerationOutput | AiTranslationOutput | AiTextClassificationOutput | AiTextEmbeddingsOutput | AiImageClassificationOutput | AiSpeechRecognitionOutput | AiTextToImageOutput | AiObjectDetectionOutput | AiSentenceSimilarityOutput | AiSummarizationOutput | AiImageToTextOutput | Record<string, unknown>;

// https://yarnpkg.com/package?name=%40cloudflare%2Fai&version=1.0.53&file=%2Fdist%2Fcatalog.d.ts
export type AiTextClassicationModel = 
    | '@cf/huggingface/distilbert-sst-2-int8'
    | '@cf/jpmorganchase/roberta-spam' // unreleased
    ;
export type AiTextToImageModel = 
    | '@cf/stabilityai/stable-diffusion-xl-base-1.0'
    | '@cf/runwayml/stable-diffusion-v1-5-inpainting'
    | '@cf/runwayml/stable-diffusion-v1-5-img2img'
    | '@cf/lykon/dreamshaper-8-lcm'
    | '@cf/bytedance/stable-diffusion-xl-lightning'
    ;
export type AiSentenceSimilarityModel = 
    | '@hf/sentence-transformers/all-minilm-l6-v2' // unreleased
    ;
export type AiTextEmbeddingsModel = 
    | '@cf/baai/bge-small-en-v1.5' 
    | '@cf/baai/bge-base-en-v1.5' 
    | '@cf/baai/bge-large-en-v1.5' 
    | '@hf/baai/bge-base-en-v1.5' // unreleased
    ;
export type AiSpeechRecognitionModel = 
    | '@cf/openai/whisper'
    ;
export type AiImageClassificationModel = 
    | '@cf/microsoft/resnet-50'
    ;
export type AiObjectDetectionModel = 
    | '@cf/facebook/detr-resnet-50'
    ;
export type AiTextGenerationModel = 
    | '@cf/meta/llama-2-7b-chat-int8' 
    | '@cf/mistral/mistral-7b-instruct-v0.1' 
    | '@cf/meta/llama-2-7b-chat-fp16' 
    | '@hf/thebloke/llama-2-13b-chat-awq' 
    | '@hf/thebloke/zephyr-7b-beta-awq' 
    | '@hf/thebloke/mistral-7b-instruct-v0.1-awq' 
    | '@hf/thebloke/codellama-7b-instruct-awq'
    | '@hf/thebloke/openchat_3.5-awq' 
    | '@hf/thebloke/openhermes-2.5-mistral-7b-awq' 
    | '@hf/thebloke/starling-lm-7b-alpha-awq' 
    | '@hf/thebloke/orca-2-13b-awq' 
    | '@hf/thebloke/neural-chat-7b-v3-1-awq' 
    | '@hf/thebloke/llamaguard-7b-awq' 
    | '@hf/thebloke/deepseek-coder-6.7b-base-awq' 
    | '@hf/thebloke/deepseek-coder-6.7b-instruct-awq'
    | '@cf/deepseek-ai/deepseek-math-7b-base'
    | '@cf/deepseek-ai/deepseek-math-7b-instruct'
    | '@cf/defog/sqlcoder-7b-2'
    | '@cf/openchat/openchat-3.5-0106'
    | '@cf/tiiuae/falcon-7b-instruct'
    | '@cf/thebloke/discolm-german-7b-v1-awq'
    | '@cf/qwen/qwen1.5-0.5b-chat'
    | '@cf/qwen/qwen1.5-1.8b-chat'
    | '@cf/qwen/qwen1.5-7b-chat-awq'
    | '@cf/qwen/qwen1.5-14b-chat-awq'
    | '@cf/tinyllama/tinyllama-1.1b-chat-v1.0'
    | '@cf/microsoft/phi-2'
    | '@cf/thebloke/yarn-mistral-7b-64k-awq'
    ;

export type AiTranslationModel = 
    | '@cf/meta/m2m100-1.2b'
    ;

export type AiSummarizationModel =
    | '@cf/facebook/bart-large-cnn'
    ;

export type AiImageToTextModel =
    | '@cf/unum/uform-gen2-qwen-500m'
    ;

export type AiModel = AiTextClassicationModel | AiTextToImageModel | AiSentenceSimilarityModel | AiTextEmbeddingsModel | AiSpeechRecognitionModel | AiImageClassificationModel | AiObjectDetectionModel | AiTextGenerationModel | AiTranslationModel | AiSummarizationModel | AiImageToTextModel;

//#endregion

//#region Version Metadata

export interface VersionMetadata {
    readonly id: string;
    readonly tag: string;
}

//#endregion

//#region Email Workers

export interface EmailMessage {
    /** Envelope From attribute of the email message. */
    readonly from: string;

    /** Envelope To attribute of the email message. */
    readonly to: string;
}

export interface IncomingEmailMessage extends EmailMessage {

    /** Email headers */
    readonly headers: Headers;

    /** Stream of the email message content. */
    readonly raw: ReadableStream;

    /** Size of the email message content. */
    readonly rawSize: number;

    /** Reject this email message by returning a permanent SMTP error back to the connecting client, including the given reason. */
    setReject(reason: string): void;

    /** Forward this email message to a verified destination address of the account. 
     * 
     * If you want, you can add extra headers to the email message. Only X-* headers are allowed.
     * 
     * When the promise resolves, the message is confirmed to be forwarded to a verified destination address. */
    forward(rcptTo: string, headers?: Headers): Promise<void>;

    /** Reply to the sender of this email message with a new EmailMessage object.
     * 
     * When the promise resolves, the message is confirmed to be replied. */
    reply(message: EmailMessage): Promise<void>;
}

export interface EmailMessageConstructable {
    new(from: string, to: string, raw: ReadableStream | string): EmailMessage;
}

export interface EmailSender {
    send(message: EmailMessage): Promise<void>;
}

//#endregion

//#region Rate Limiting

export interface Ratelimiter {
    limit(opts: { key: string }): Promise<{ success: boolean }>;
}

//#endregion

//#region Pipelines

export interface Pipeline {
    send(data: object[]): Promise<void>;
}

export interface PipelineTransform {
    transformJson(data: object[]): Promise<object[]>;
}

//#endregion

//#region Workers for Platforms

export interface DispatchNamespace {
    /**
     * Get a dispatcher for a given user worker script in this dispatch namespace.
     * 
     * @param name User worker script name.
     * @param args Args to the worker script, if any.
     * @param options Options and limits for the returned dispatcher.
     */
    get(name: string, args?: Record<string, unknown>, options?: DispatchOptions): CloudflareFetcher;
}

export interface DispatchOptions {
    /** Limit resources of invoked Worker script. */
    readonly limits?: {
        /** Limit CPU time in milliseconds */
        readonly cpuMs?: number;

        /** Limit number of subrequests. */
        readonly subRequests?: number;
    }

    /** Arguments for outbound Worker script, if configured. */
    readonly outbound?: Record<string, unknown>;
}

//#endregion

//#region Workers static assets

export interface Assets {
    fetch: typeof fetch;
}

//#endregion

//#region Workers VPC Services

export interface VpcService {
    fetch: typeof fetch;
}

//#endregion

//#region Workers AI

export interface AI {
    // deno-lint-ignore no-explicit-any
    run(model: string, options: unknown): Promise<any>;
}

//#endregion
