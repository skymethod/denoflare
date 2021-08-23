export class Constants {
    static readonly MAX_CONTENT_LENGTH_TO_PACK_OVER_RPC = 1024 * 1024 * 5; // bypass read-body-chunk for fetch responses with defined content-length under this limit
}