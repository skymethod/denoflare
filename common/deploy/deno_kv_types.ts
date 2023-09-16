export interface KvService {

    /** **UNSTABLE**: New API, yet to be vetted.
       *
       * Open a new {@linkcode Kv} connection to persist data.
       *
       * When a path is provided, the database will be persisted to disk at that
       * path. Read and write access to the file is required.
       *
       * When no path is provided, the database will be opened in a default path for
       * the current script. This location is persistent across script runs and is
       * keyed on the origin storage key (the same key that is used to determine
       * `localStorage` persistence). More information about the origin storage key
       * can be found in the Deno Manual.
       *
       * @tags allow-read, allow-write
       * @category KV
       */
    openKv(path?: string): Promise<Kv>;

    /** Create a new `KvU64` instance from the given bigint value. If the value
     * is signed or greater than 64-bits, an error will be thrown. */
    newKvU64(value: bigint): KvU64;

}

export interface Kv {
    /**
     * Retrieve the value and versionstamp for the given key from the database
     * in the form of a {@linkcode KvEntryMaybe}. If no value exists for
     * the key, the returned entry will have a `null` value and versionstamp.
     *
     * ```ts
     * const db = await openKv();
     * const result = await db.get(["foo"]);
     * result.key; // ["foo"]
     * result.value; // "bar"
     * result.versionstamp; // "00000000000000010000"
     * ```
     *
     * The `consistency` option can be used to specify the consistency level
     * for the read operation. The default consistency level is "strong". Some
     * use cases can benefit from using a weaker consistency level. For more
     * information on consistency levels, see the documentation for
     * {@linkcode KvConsistencyLevel}.
     */
    get<T = unknown>(
        key: KvKey,
        options?: { consistency?: KvConsistencyLevel },
    ): Promise<KvEntryMaybe<T>>;

    /**
     * Retrieve multiple values and versionstamps from the database in the form
     * of an array of {@linkcode KvEntryMaybe} objects. The returned array
     * will have the same length as the `keys` array, and the entries will be in
     * the same order as the keys. If no value exists for a given key, the
     * returned entry will have a `null` value and versionstamp.
     *
     * ```ts
     * const db = await openKv();
     * const result = await db.getMany([["foo"], ["baz"]]);
     * result[0].key; // ["foo"]
     * result[0].value; // "bar"
     * result[0].versionstamp; // "00000000000000010000"
     * result[1].key; // ["baz"]
     * result[1].value; // null
     * result[1].versionstamp; // null
     * ```
     *
     * The `consistency` option can be used to specify the consistency level
     * for the read operation. The default consistency level is "strong". Some
     * use cases can benefit from using a weaker consistency level. For more
     * information on consistency levels, see the documentation for
     * {@linkcode KvConsistencyLevel}.
     */
    getMany<T extends readonly unknown[]>(
        keys: readonly [...{ [K in keyof T]: KvKey }],
        options?: { consistency?: KvConsistencyLevel },
    ): Promise<{ [K in keyof T]: KvEntryMaybe<T[K]> }>;
    /**
     * Set the value for the given key in the database. If a value already
     * exists for the key, it will be overwritten.
     *
     * ```ts
     * const db = await openKv();
     * await db.set(["foo"], "bar");
     * ```
     *
     * Optionally an `expireIn` option can be specified to set a time-to-live
     * (TTL) for the key. The TTL is specified in milliseconds, and the key will
     * be deleted from the database at earliest after the specified number of
     * milliseconds have elapsed. Once the specified duration has passed, the
     * key may still be visible for some additional time. If the `expireIn`
     * option is not specified, the key will not expire.
     */
    set(
        key: KvKey,
        value: unknown,
        options?: { expireIn?: number },
    ): Promise<KvCommitResult>;

    /**
     * Delete the value for the given key from the database. If no value exists
     * for the key, this operation is a no-op.
     *
     * ```ts
     * const db = await openKv();
     * await db.delete(["foo"]);
     * ```
     */
    delete(key: KvKey): Promise<void>;

    /**
     * Retrieve a list of keys in the database. The returned list is an
     * {@linkcode KvListIterator} which can be used to iterate over the
     * entries in the database.
     *
     * Each list operation must specify a selector which is used to specify the
     * range of keys to return. The selector can either be a prefix selector, or
     * a range selector:
     *
     * - A prefix selector selects all keys that start with the given prefix of
     *   key parts. For example, the selector `["users"]` will select all keys
     *   that start with the prefix `["users"]`, such as `["users", "alice"]`
     *   and `["users", "bob"]`. Note that you can not partially match a key
     *   part, so the selector `["users", "a"]` will not match the key
     *   `["users", "alice"]`. A prefix selector may specify a `start` key that
     *   is used to skip over keys that are lexicographically less than the
     *   start key.
     * - A range selector selects all keys that are lexicographically between
     *   the given start and end keys (including the start, and excluding the
     *   end). For example, the selector `["users", "a"], ["users", "n"]` will
     *   select all keys that start with the prefix `["users"]` and have a
     *   second key part that is lexicographically between `a` and `n`, such as
     *   `["users", "alice"]`, `["users", "bob"]`, and `["users", "mike"]`, but
     *   not `["users", "noa"]` or `["users", "zoe"]`.
     *
     * ```ts
     * const db = await openKv();
     * const entries = db.list({ prefix: ["users"] });
     * for await (const entry of entries) {
     *   entry.key; // ["users", "alice"]
     *   entry.value; // { name: "Alice" }
     *   entry.versionstamp; // "00000000000000010000"
     * }
     * ```
     *
     * The `options` argument can be used to specify additional options for the
     * list operation. See the documentation for {@linkcode KvListOptions}
     * for more information.
     */
    list<T = unknown>(
        selector: KvListSelector,
        options?: KvListOptions,
    ): KvListIterator<T>;

    /**
     * Add a value into the database queue to be delivered to the queue
     * listener via {@linkcode Kv.listenQueue}.
     *
     * ```ts
     * const db = await openKv();
     * await db.enqueue("bar");
     * ```
     *
     * The `delay` option can be used to specify the delay (in milliseconds)
     * of the value delivery. The default delay is 0, which means immediate
     * delivery.
     *
     * ```ts
     * const db = await openKv();
     * await db.enqueue("bar", { delay: 60000 });
     * ```
     *
     * The `keysIfUndelivered` option can be used to specify the keys to
     * be set if the value is not successfully delivered to the queue
     * listener after several attempts. The values are set to the value of
     * the queued message.
     *
     * ```ts
     * const db = await openKv();
     * await db.enqueue("bar", { keysIfUndelivered: [["foo", "bar"]] });
     * ```
     */
    enqueue(
        value: unknown,
        options?: { delay?: number; keysIfUndelivered?: KvKey[] },
    ): Promise<KvCommitResult>;

    /**
     * Listen for queue values to be delivered from the database queue, which
     * were enqueued with {@linkcode Kv.enqueue}. The provided handler
     * callback is invoked on every dequeued value. A failed callback
     * invocation is automatically retried multiple times until it succeeds
     * or until the maximum number of retries is reached.
     *
     * ```ts
     * const db = await openKv();
     * db.listenQueue(async (msg: unknown) => {
     *   await db.set(["foo"], msg);
     * });
     * ```
     */
    listenQueue(
        handler: (value: unknown) => Promise<void> | void,
    ): Promise<void>;

    /**
     * Create a new {@linkcode AtomicOperation} object which can be used to
     * perform an atomic transaction on the database. This does not perform any
     * operations on the database - the atomic transaction must be committed
     * explicitly using the {@linkcode AtomicOperation.commit} method once
     * all checks and mutations have been added to the operation.
     */
    atomic(): AtomicOperation;

    /**
     * Close the database connection. This will prevent any further operations
     * from being performed on the database, and interrupt any in-flight
     * operations immediately.
     */
    close(): void;
}

/** **UNSTABLE**: New API, yet to be vetted.
 *
 * A key to be persisted in a {@linkcode Kv}. A key is a sequence
 * of {@linkcode KvKeyPart}s.
 *
 * Keys are ordered lexicographically by their parts. The first part is the
 * most significant, and the last part is the least significant. The order of
 * the parts is determined by both the type and the value of the part. The
 * relative significance of the types can be found in documentation for the
 * {@linkcode KvKeyPart} type.
 *
 * Keys have a maximum size of 2048 bytes serialized. If the size of the key
 * exceeds this limit, an error will be thrown on the operation that this key
 * was passed to.
 *
 * @category KV
 */
export type KvKey = readonly KvKeyPart[];



/** **UNSTABLE**: New API, yet to be vetted.
*
* A single part of a {@linkcode KvKey}. Parts are ordered
* lexicographically, first by their type, and within a given type by their
* value.
*
* The ordering of types is as follows:
*
* 1. `Uint8Array`
* 2. `string`
* 3. `number`
* 4. `bigint`
* 5. `boolean`
*
* Within a given type, the ordering is as follows:
*
* - `Uint8Array` is ordered by the byte ordering of the array
* - `string` is ordered by the byte ordering of the UTF-8 encoding of the
*   string
* - `number` is ordered following this pattern: `-NaN`
*   < `-Infinity` < `-100.0` < `-1.0` < -`0.5` < `-0.0` < `0.0` < `0.5`
*   < `1.0` < `100.0` < `Infinity` < `NaN`
* - `bigint` is ordered by mathematical ordering, with the largest negative
*   number being the least first value, and the largest positive number
*   being the last value
* - `boolean` is ordered by `false` < `true`
*
* This means that the part `1.0` (a number) is ordered before the part `2.0`
* (also a number), but is greater than the part `0n` (a bigint), because
* `1.0` is a number and `0n` is a bigint, and type ordering has precedence
* over the ordering of values within a type.
*
* @category KV
*/
export type KvKeyPart = Uint8Array | string | number | bigint | boolean;

/** **UNSTABLE**: New API, yet to be vetted.
 *
 * Consistency level of a KV operation.
 *
 * - `strong` - This operation must be strongly-consistent.
 * - `eventual` - Eventually-consistent behavior is allowed.
 *
 * @category KV
 */
export type KvConsistencyLevel = "strong" | "eventual";

/**
 * **UNSTABLE**: New API, yet to be vetted.
 *
 * An optional versioned pair of key and value in a {@linkcode Kv}.
 *
 * This is the same as a {@linkcode KvEntry}, but the `value` and `versionstamp`
 * fields may be `null` if no value exists for the given key in the KV store.
 *
 * @category KV
 */
export type KvEntryMaybe<T> = KvEntry<T> | {
    key: KvKey;
    value: null;
    versionstamp: null;
};

/** **UNSTABLE**: New API, yet to be vetted.
 *
 * A versioned pair of key and value in a {@linkcode Kv}.
 *
 * The `versionstamp` is a string that represents the current version of the
 * key-value pair. It can be used to perform atomic operations on the KV store
 * by passing it to the `check` method of a {@linkcode AtomicOperation}.
 *
 * @category KV
 */
export type KvEntry<T> = { key: KvKey; value: T; versionstamp: string };

/** @category KV */
export interface KvCommitResult {
    ok: true;
    /** The versionstamp of the value committed to KV. */
    versionstamp: string;
}

/** **UNSTABLE**: New API, yet to be vetted.
 *
 * A selector that selects the range of data returned by a list operation on a
 * {@linkcode Kv}.
 *
 * The selector can either be a prefix selector or a range selector. A prefix
 * selector selects all keys that start with the given prefix (optionally
 * starting at a given key). A range selector selects all keys that are
 * lexicographically between the given start and end keys.
 *
 * @category KV
 */
export type KvListSelector =
    | { prefix: KvKey }
    | { prefix: KvKey; start: KvKey }
    | { prefix: KvKey; end: KvKey }
    | { start: KvKey; end: KvKey };


/** **UNSTABLE**: New API, yet to be vetted.
 *
 * Options for listing key-value pairs in a {@linkcode Kv}.
 *
 * @category KV
 */
export interface KvListOptions {
    /**
     * The maximum number of key-value pairs to return. If not specified, all
     * matching key-value pairs will be returned.
     */
    limit?: number;
    /**
     * The cursor to resume the iteration from. If not specified, the iteration
     * will start from the beginning.
     */
    cursor?: string;
    /**
     * Whether to reverse the order of the returned key-value pairs. If not
     * specified, the order will be ascending from the start of the range as per
     * the lexicographical ordering of the keys. If `true`, the order will be
     * descending from the end of the range.
     *
     * The default value is `false`.
     */
    reverse?: boolean;
    /**
     * The consistency level of the list operation. The default consistency
     * level is "strong". Some use cases can benefit from using a weaker
     * consistency level. For more information on consistency levels, see the
     * documentation for {@linkcode KvConsistencyLevel}.
     *
     * List operations are performed in batches (in sizes specified by the
     * `batchSize` option). The consistency level of the list operation is
     * applied to each batch individually. This means that while each batch is
     * guaranteed to be consistent within itself, the entire list operation may
     * not be consistent across batches because a mutation may be applied to a
     * key-value pair between batches, in a batch that has already been returned
     * by the list operation.
     */
    consistency?: KvConsistencyLevel;
    /**
     * The size of the batches in which the list operation is performed. Larger
     * or smaller batch sizes may positively or negatively affect the
     * performance of a list operation depending on the specific use case and
     * iteration behavior. Slow iterating queries may benefit from using a
     * smaller batch size for increased overall consistency, while fast
     * iterating queries may benefit from using a larger batch size for better
     * performance.
     *
     * The default batch size is equal to the `limit` option, or 100 if this is
     * unset. The maximum value for this option is 500. Larger values will be
     * clamped.
     */
    batchSize?: number;
}

/** **UNSTABLE**: New API, yet to be vetted.
*
* An iterator over a range of data entries in a {@linkcode Kv}.
*
* The cursor getter returns the cursor that can be used to resume the
* iteration from the current position in the future.
*
* @category KV
*/
export interface KvListIterator<T> extends AsyncIterableIterator<KvEntry<T>> {
    /**
     * Returns the cursor of the current position in the iteration. This cursor
     * can be used to resume the iteration from the current position in the
     * future by passing it to the `cursor` option of the `list` method.
     */
    get cursor(): string;

    next(): Promise<IteratorResult<KvEntry<T>, undefined>>;
    [Symbol.asyncIterator](): AsyncIterableIterator<KvEntry<T>>;
}


/** **UNSTABLE**: New API, yet to be vetted.
 *
 * An operation on a {@linkcode Kv} that can be performed
 * atomically. Atomic operations do not auto-commit, and must be committed
 * explicitly by calling the `commit` method.
 *
 * Atomic operations can be used to perform multiple mutations on the KV store
 * in a single atomic transaction. They can also be used to perform
 * conditional mutations by specifying one or more
 * {@linkcode AtomicCheck}s that ensure that a mutation is only performed
 * if the key-value pair in the KV has a specific versionstamp. If any of the
 * checks fail, the entire operation will fail and no mutations will be made.
 *
 * The ordering of mutations is guaranteed to be the same as the ordering of
 * the mutations specified in the operation. Checks are performed before any
 * mutations are performed. The ordering of checks is unobservable.
 *
 * Atomic operations can be used to implement optimistic locking, where a
 * mutation is only performed if the key-value pair in the KV store has not
 * been modified since the last read. This can be done by specifying a check
 * that ensures that the versionstamp of the key-value pair matches the
 * versionstamp that was read. If the check fails, the mutation will not be
 * performed and the operation will fail. One can then retry the read-modify-
 * write operation in a loop until it succeeds.
 *
 * The `commit` method of an atomic operation returns a value indicating
 * whether checks passed and mutations were performed. If the operation failed
 * because of a failed check, the return value will be a
 * {@linkcode KvCommitError} with an `ok: false` property. If the
 * operation failed for any other reason (storage error, invalid value, etc.),
 * an exception will be thrown. If the operation succeeded, the return value
 * will be a {@linkcode KvCommitResult} object with a `ok: true` property
 * and the versionstamp of the value committed to KV.

 *
 * @category KV
 */
export interface AtomicOperation {
    /**
     * Add to the operation a check that ensures that the versionstamp of the
     * key-value pair in the KV store matches the given versionstamp. If the
     * check fails, the entire operation will fail and no mutations will be
     * performed during the commit.
     */
    check(...checks: AtomicCheck[]): this;
    /**
     * Add to the operation a mutation that performs the specified mutation on
     * the specified key if all checks pass during the commit. The types and
     * semantics of all available mutations are described in the documentation
     * for {@linkcode KvMutation}.
     */
    mutate(...mutations: KvMutation[]): this;
    /**
     * Shortcut for creating a `sum` mutation. This method wraps `n` in a
     * {@linkcode KvU64}, so the value of `n` must be in the range
     * `[0, 2^64-1]`.
     */
    sum(key: KvKey, n: bigint): this;
    /**
     * Shortcut for creating a `min` mutation. This method wraps `n` in a
     * {@linkcode KvU64}, so the value of `n` must be in the range
     * `[0, 2^64-1]`.
     */
    min(key: KvKey, n: bigint): this;
    /**
     * Shortcut for creating a `max` mutation. This method wraps `n` in a
     * {@linkcode KvU64}, so the value of `n` must be in the range
     * `[0, 2^64-1]`.
     */
    max(key: KvKey, n: bigint): this;
    /**
     * Add to the operation a mutation that sets the value of the specified key
     * to the specified value if all checks pass during the commit.
     *
     * Optionally an `expireIn` option can be specified to set a time-to-live
     * (TTL) for the key. The TTL is specified in milliseconds, and the key will
     * be deleted from the database at earliest after the specified number of
     * milliseconds have elapsed. Once the specified duration has passed, the
     * key may still be visible for some additional time. If the `expireIn`
     * option is not specified, the key will not expire.
     */
    set(key: KvKey, value: unknown, options?: { expireIn?: number }): this;
    /**
     * Add to the operation a mutation that deletes the specified key if all
     * checks pass during the commit.
     */
    delete(key: KvKey): this;
    /**
     * Add to the operation a mutation that enqueues a value into the queue
     * if all checks pass during the commit.
     */
    enqueue(
        value: unknown,
        options?: { delay?: number; keysIfUndelivered?: KvKey[] },
    ): this;
    /**
     * Commit the operation to the KV store. Returns a value indicating whether
     * checks passed and mutations were performed. If the operation failed
     * because of a failed check, the return value will be a {@linkcode
     * KvCommitError} with an `ok: false` property. If the operation failed
     * for any other reason (storage error, invalid value, etc.), an exception
     * will be thrown. If the operation succeeded, the return value will be a
     * {@linkcode KvCommitResult} object with a `ok: true` property and the
     * versionstamp of the value committed to KV.
     *
     * If the commit returns `ok: false`, one may create a new atomic operation
     * with updated checks and mutations and attempt to commit it again. See the
     * note on optimistic locking in the documentation for
     * {@linkcode AtomicOperation}.
     */
    commit(): Promise<KvCommitResult | KvCommitError>;
}

/** **UNSTABLE**: New API, yet to be vetted.
 *
 * A check to perform as part of a {@linkcode AtomicOperation}. The check
 * will fail if the versionstamp for the key-value pair in the KV store does
 * not match the given versionstamp. A check with a `null` versionstamp checks
 * that the key-value pair does not currently exist in the KV store.
 *
 * @category KV
 */
export interface AtomicCheck {
    key: KvKey;
    versionstamp: string | null;
}

/** @category KV */
export interface KvCommitError {
    ok: false;
}
/** **UNSTABLE**: New API, yet to be vetted.
 *
 * A mutation to a key in a {@linkcode Kv}. A mutation is a
 * combination of a key, a value, and a type. The type determines how the
 * mutation is applied to the key.
 *
 * - `set` - Sets the value of the key to the given value, overwriting any
 *   existing value. Optionally an `expireIn` option can be specified to
 *   set a time-to-live (TTL) for the key. The TTL is specified in
 *   milliseconds, and the key will be deleted from the database at earliest
 *   after the specified number of milliseconds have elapsed. Once the
 *   specified duration has passed, the key may still be visible for some
 *   additional time. If the `expireIn` option is not specified, the key will
 *   not expire.
 * - `delete` - Deletes the key from the database. The mutation is a no-op if
 *   the key does not exist.
 * - `sum` - Adds the given value to the existing value of the key. Both the
 *   value specified in the mutation, and any existing value must be of type
 *   `KvU64`. If the key does not exist, the value is set to the given
 *   value (summed with 0). If the result of the sum overflows an unsigned
 *   64-bit integer, the result is wrapped around.
 * - `max` - Sets the value of the key to the maximum of the existing value
 *   and the given value. Both the value specified in the mutation, and any
 *   existing value must be of type `KvU64`. If the key does not exist,
 *   the value is set to the given value.
 * - `min` - Sets the value of the key to the minimum of the existing value
 *   and the given value. Both the value specified in the mutation, and any
 *   existing value must be of type `KvU64`. If the key does not exist,
 *   the value is set to the given value.
 *
 * @category KV
 */
export type KvMutation =
    & { key: KvKey }
    & (
        | { type: "set"; value: unknown; expireIn?: number }
        | { type: "delete" }
        | { type: "sum"; value: KvU64 }
        | { type: "max"; value: KvU64 }
        | { type: "min"; value: KvU64 }
    );

/** **UNSTABLE**: New API, yet to be vetted.
*
* Wrapper type for 64-bit unsigned integers for use as values in a
* {@linkcode Kv}.
*
* @category KV
*/
export interface KvU64 {
    /** Create a new `KvU64` instance from the given bigint value. If the value
     * is signed or greater than 64-bits, an error will be thrown. */
    // constructor(value: bigint);
    /** The value of this unsigned 64-bit integer, represented as a bigint. */
    readonly value: bigint;
}
