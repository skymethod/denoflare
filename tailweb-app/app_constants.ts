export class AppConstants {
    static readonly WEBSOCKET_PING_INTERVAL_SECONDS = 10; // send an empty message down the ws to detect bad connections faster
    static readonly INACTIVE_TAIL_SECONDS = 5; // reclaim inactive tails older than this
}
