function base64Decode(str) {
    str = atob(str);
    const
        length = str.length,
        buf = new ArrayBuffer(length),
        bufView = new Uint8Array(buf);
    for (let i = 0; i < length; i++) { bufView[i] = str.charCodeAt(i) }
    return bufView;
}

export const BYTES = base64Decode('EXPORT_B64');;
