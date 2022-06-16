export interface MqttConnection {
    write(bytes: Uint8Array): Promise<number>;
    onRead: (bytes: Uint8Array) => void;
    readonly completionPromise: Promise<void>;
    close(): void;
}
