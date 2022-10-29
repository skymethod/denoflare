
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

export interface IncomingRequestCf extends Request {
    /** An object containing properties about the incoming request provided by Cloudflare’s edge network. */
    readonly cf: IncomingRequestCfProperties;

    // undocumented
    readonly fetcher: Record<string, unknown>; // ???
}

/** An object containing properties about the incoming request provided by Cloudflare’s edge network. */
export interface IncomingRequestCfProperties {
    // https://developers.cloudflare.com/workers/runtime-apis/request#incomingrequestcfproperties

    /** ASN of the incoming request, e.g. 395747. */
    readonly asn: number;

    /** The organisation which owns the ASN of the incoming request, e.g. Google Cloud. */
    readonly asOrganization: string;

    /** The three-letter IATA airport code of the data center that the request hit, e.g. "DFW". */
    readonly colo: string;

    /** Country of the incoming request. 
     * 
     * The two-letter country code in the request. This is the same value as that provided in the CF-IPCountry header, e.g. "US". */
    readonly country: string | null;

    /** HTTP Protocol, e.g. "HTTP/2". */
    readonly httpProtocol: string;

    /** The browser-requested prioritization information in the request object, e.g. "weight=192;exclusive=0;group=3;group-weight=127". */
    readonly requestPriority: string | null;

    /** The cipher for the connection to Cloudflare, e.g. "AEAD-AES128-GCM-SHA256". */
    readonly tlsCipher: string;

    /** Only set when using Cloudflare Access or API Shield. */
    readonly tlsClientAuth: TlsClientAuth | null;

    /** The TLS version of the connection to Cloudflare, e.g. TLSv1.3. */
    readonly tlsVersion: string;

    // 2021-04-13: these are now free! https://blog.cloudflare.com/location-based-personalization-using-workers/

    /** City of the incoming request, e.g. "Austin". */
    readonly city: string | null;

    /** Accept-Encoding of the incoming request, e.g. gzip, deflate, br */
    readonly clientAcceptEncoding?: string; 

    /** Continent of the incoming request, e.g. "NA". */
    readonly continent: string | null;

    /** Latitude of the incoming request, e.g. "30.27130". */
    readonly latitude: string | null;

    /** Longitude of the incoming request, e.g. "-97.74260". */
    readonly longitude: string | null;

    /** Postal code of the incoming request, e.g. "78701". */
    readonly postalCode: string | null;

    /** Metro code (DMA) of the incoming request, e.g. "635". */
    readonly metroCode: string | null;

    /** If known, the [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) name for the first level region associated with the IP address of the incoming request, e.g. "Texas". */
    readonly region: string | null;

    /** If known, the [ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) code for the first level region associated with the IP address of the incoming request, e.g. "TX". */
    readonly regionCode: string | null;

    /** Timezone of the incoming request, e.g. "America/Chicago". */
    readonly timezone: string;

    // undocumented

    readonly edgeRequestKeepAliveStatus: number; // e.g. 1
    readonly clientTcpRtt: number; // e.g. 35
    readonly weight: string; // e.g. "UNDEFINED"  (free only?)
    readonly tlsExportedAuthenticator: TlsExportedAuthenticator;
}

export interface TlsExportedAuthenticator {
    readonly clientFinished: string; // e.g. e138d272eedf10ff081b2614c40c22e2a2e1c272aeef6e9ba8517dd19e4908c4
    readonly clientHandshake: string; 
    readonly serverHandshake: string;
    readonly serverFinished: string;
}

export interface TlsClientAuth {
    readonly certIssuerDNLegacy: string,
    readonly certIssuerDN: string,
    readonly certIssuerDNRFC2253: string,
    readonly certSubjectDNLegacy: string,
    readonly certVerified: string,
    readonly certNotAfter: string,
    readonly certSubjectDN: string,
    readonly certFingerprintSHA1: string,
    readonly certNotBefore: string,
    readonly certSerial: string,
    readonly certPresented: string,
    readonly certSubjectDNRFC2253: string,

    // undocumented
    readonly certFingerprintSHA256: string;
    readonly certIssuerSKI: string;
    readonly certRevoked: string;
    readonly certSKI: string;
}

//#endregion

//#region Business and Enterprise only

export interface IncomingRequestCfBusinessAndEnterpriseProperties extends IncomingRequestCfProperties {
    // undocumented
    readonly clientTrustScore: number; // e.g. 99
    readonly botManagement: BotManagement;
}

export interface BotManagement {
    readonly score: number; // e.g. 99
    readonly verifiedBot: boolean;
    readonly staticResource: boolean;
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
};
*/

// deno-lint-ignore no-empty-interface
export interface ModuleWorkerContext extends WorkerContextMethods {

}

// deno-lint-ignore no-empty-interface
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
    get(key: string, opts: KVGetOptions | { type: 'text' }): Promise<string | null>;
    get(key: string, opts: KVGetOptions | { type: 'json' }): Promise<Record<string, unknown> | null>;
    get(key: string, opts: KVGetOptions | { type: 'arrayBuffer' }): Promise<ArrayBuffer | null>;
    get(key: string, opts: KVGetOptions | { type: 'stream' }): Promise<ReadableStream | null>;

    // https://developers.cloudflare.com/workers/runtime-apis/kv#metadata-1

    /** Gets the metadata associated with a key-value pair alongside its value.
     * 
     * If there’s no metadata associated with the requested key-value pair, null will be returned for metadata. */
    getWithMetadata(key: string, opts: KVGetOptions | { type: 'text' }): Promise<KVValueAndMetadata<string> | null>;
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
    newUniqueId(opts?: { jurisdiction: 'eu' }): DurableObjectId;

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
     * https://developers.cloudflare.com/workers/runtime-apis/durable-objects#obtaining-an-object-stub
     * */
    get(id: DurableObjectId): DurableObjectStub;
}

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

// deno-lint-ignore ban-types
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

    /** Notifies the runtime to wait for the completion of asynchronous tasks that may complete after a response has already been sent. 
     * 
     * See [waitUntil()](https://developer.mozilla.org/en-US/docs/Web/API/ExtendableEvent/waitUntil) for a detailed reference. */
    waitUntil(promise: Promise<unknown>): void;

    /** Useful for delaying delivery of requests and other events while performing some critical state-affecting task. 
     * 
     * For example, this can be used to perform start-up initialization in an object’s constructor. */
    blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
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
    readonly uploaded: Date;
    readonly httpMetadata: R2HTTPMetadata;
    readonly customMetadata: Record<string, string>;
    readonly range?: R2Range;
    writeHttpMetadata(headers: Headers): void;
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
    readonly httpMetadata?: R2HTTPMetadata | Headers;
    readonly customMetadata?: Record<string, string>;
    readonly md5?: ArrayBuffer | string; // hex if string
}

export type R2Range =
  | { offset: number; length?: number }
  | { offset?: number; length: number }
  | { suffix: number };

//#endregion

//#region Analytics Engine

export interface AnalyticsEngine {
    writeDataPoint(event: AnalyticsEngineEvent): void;
}
  
export interface AnalyticsEngineEvent {
    readonly doubles?: number[]; // up to 20
    readonly blobs?: (ArrayBuffer | string | null)[]; // up to 20, max sum of all blobs: 5kb
    readonly indexes?: string[]; // 0 or 1
}

//#endregion

//#region D1

export interface D1Database {
    readonly fetch: typeof fetch;
}

//#endregion
