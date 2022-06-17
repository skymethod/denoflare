/** 
 * Low-level abstraction for a single bi-directional MQTT connection to a server. 
 * 
 * Can be used to provide custom protocol handler implementations for the higher-level MqttClient.
*/
export interface MqttConnection {

    /** Writes bytes to the outgoing connection to the server. */
    write(bytes: Uint8Array): Promise<number>;

    /** Called when incoming bytes are received from the server. */
    onRead: (bytes: Uint8Array) => void;

    /** Resolves when the connection is closed. */
    readonly completionPromise: Promise<void>;

    /** Closes the connection. */
    close(): void;
}
