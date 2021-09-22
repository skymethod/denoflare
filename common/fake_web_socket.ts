// deno-lint-ignore-file no-unused-vars no-explicit-any
export class FakeWebSocket {

    private readonly className: string;

    constructor(className: string) {
        this.className = className;
    }

    readonly CLOSED: number = WebSocket.CLOSED;
    readonly CLOSING: number = WebSocket.CLOSING;
    readonly CONNECTING: number  = WebSocket.CONNECTING;
    readonly OPEN: number = WebSocket.OPEN;

    /**
     * Returns a string that indicates how binary data from the WebSocket object is exposed to scripts:
     *
     * Can be set, to change how binary data is returned. The default is "blob".
     */
    get binaryType(): BinaryType { throw new Error(`${this.className}.binaryType.get: not implemented`); }
    set binaryType(value: BinaryType) { throw new Error(`${this.className}.binaryType.set: not implemented`); }

    /**
     * Returns the number of bytes of application data (UTF-8 text and binary data) that have been queued using send() but not yet been transmitted to the network.
     *
     * If the WebSocket connection is closed, this attribute's value will only increase with each call to the send() method. (The number does not reset to zero once the connection closes.)
     */
    get bufferedAmount(): number { throw new Error(`${this.className}.bufferedAmount: not implemented`); }

    /**
     * Returns the extensions selected by the server, if any.
     */
    get extensions(): string { throw new Error(`${this.className}.extensions: not implemented`); }

    get onclose(): ((this: WebSocket, ev: CloseEvent) => any) | null { throw new Error(`${this.className}.onclose.get: not implemented`); }
    set onclose(value: ((this: WebSocket, ev: CloseEvent) => any) | null) { throw new Error(`${this.className}.onclose.set: not implemented`); }

    get onerror(): ((this: WebSocket, ev: Event | ErrorEvent) => any) | null { throw new Error(`${this.className}.onerror.get: not implemented`); }
    set onerror(value: ((this: WebSocket, ev: Event | ErrorEvent) => any) | null) { throw new Error(`${this.className}.onerror.set: not implemented`); }

    get onmessage(): ((this: WebSocket, ev: MessageEvent) => any) | null { throw new Error(`${this.className}.onmessage.get: not implemented`); }
    set onmessage(value: ((this: WebSocket, ev: MessageEvent) => any) | null) { throw new Error(`${this.className}.onmessage.set: not implemented`); }

    get onopen(): ((this: WebSocket, ev: Event) => any) | null { throw new Error(`${this.className}.onopen.get: not implemented`); }
    set onopen(value: ((this: WebSocket, ev: Event) => any) | null) { throw new Error(`${this.className}.onopen.set: not implemented`); }

    /**
     * Returns the subprotocol selected by the server, if any. It can be used in conjunction with the array form of the constructor's second argument to perform subprotocol negotiation.
     */
    get protocol(): string { throw new Error(`${this.className}.protocol: not implemented`); }

    /**
     * Returns the state of the WebSocket object's connection. It can have the values described below.
     */
    get readyState(): number { throw new Error(`${this.className}.readyState: not implemented`); }

    /**
     * Returns the URL that was used to establish the WebSocket connection.
     */
    get url(): string { throw new Error(`${this.className}.url: not implemented`); }

    /**
     * Closes the WebSocket connection, optionally using code as the the WebSocket connection close code and reason as the the WebSocket connection close reason.
     */
    close(code?: number, reason?: string): void { throw new Error(`${this.className}.close: not implemented`); }

    /**
     * Transmits data using the WebSocket connection. data can be a string, a Blob, an ArrayBuffer, or an ArrayBufferView.
     */
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void { throw new Error(`${this.className}.send: not implemented`); }

    // EventTarget

    addEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        throw new Error(`${this.className}.addEventListener: not implemented`);
    }

    removeEventListener<K extends keyof WebSocketEventMap>(
        type: K,
        listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any,
        options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void;
    /** Removes the event listener in target's event listener list with the same
   * type, callback, and options. */
    removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: EventListenerOptions | boolean,
    ): void {
        throw new Error(`${this.className}.removeEventListener: not implemented`);
    }

    /** Dispatches a synthetic event event to target and returns true if either
     * event's cancelable attribute value is false or its preventDefault() method
     * was not invoked, and false otherwise. */
    dispatchEvent(event: Event): boolean {
        throw new Error(`${this.className}.dispatchEvent: not implemented`);
    }

}
