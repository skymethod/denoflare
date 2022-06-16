var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var stdin_exports = {};
__export(stdin_exports, {
  CONNACK: () => CONNACK,
  CONNECT: () => CONNECT,
  DISCONNECT: () => DISCONNECT,
  MqttClient: () => MqttClient,
  PINGREQ: () => PINGREQ,
  PINGRESP: () => PINGRESP,
  PUBLISH: () => PUBLISH,
  SUBACK: () => SUBACK,
  SUBSCRIBE: () => SUBSCRIBE,
  computeControlPacketTypeName: () => computeControlPacketTypeName
});
module.exports = __toCommonJS(stdin_exports);
const _Bytes = class {
  constructor(bytes) {
    __publicField(this, "_bytes");
    __publicField(this, "length");
    this._bytes = bytes;
    this.length = bytes.length;
  }
  array() {
    return this._bytes;
  }
  async sha1() {
    const hash = await cryptoSubtle().digest("SHA-1", this._bytes);
    return new _Bytes(new Uint8Array(hash));
  }
  async hmacSha1(key) {
    const cryptoKey = await cryptoSubtle().importKey("raw", key._bytes, {
      name: "HMAC",
      hash: "SHA-1"
    }, true, [
      "sign"
    ]);
    const sig = await cryptoSubtle().sign("HMAC", cryptoKey, this._bytes);
    return new _Bytes(new Uint8Array(sig));
  }
  async sha256() {
    const hash = await cryptoSubtle().digest("SHA-256", this._bytes);
    return new _Bytes(new Uint8Array(hash));
  }
  async hmacSha256(key) {
    const cryptoKey = await cryptoSubtle().importKey("raw", key._bytes, {
      name: "HMAC",
      hash: "SHA-256"
    }, true, [
      "sign"
    ]);
    const sig = await cryptoSubtle().sign("HMAC", cryptoKey, this._bytes);
    return new _Bytes(new Uint8Array(sig));
  }
  hex() {
    const a = Array.from(this._bytes);
    return a.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  static ofHex(hex1) {
    if (hex1 === "") {
      return _Bytes.EMPTY;
    }
    return new _Bytes(new Uint8Array(hex1.match(/.{1,2}/g).map((__byte) => parseInt(__byte, 16))));
  }
  utf8() {
    return new TextDecoder().decode(this._bytes);
  }
  static ofUtf8(str) {
    return new _Bytes(new TextEncoder().encode(str));
  }
  base64() {
    return base64Encode(this._bytes);
  }
  static ofBase64(base64, opts = {
    urlSafe: false
  }) {
    return new _Bytes(base64Decode(base64, opts.urlSafe));
  }
  static async ofStream(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const len = chunks.reduce((prev, current) => prev + current.length, 0);
    const rt = new Uint8Array(len);
    let offset = 0;
    for (const chunk1 of chunks) {
      rt.set(chunk1, offset);
      offset += chunk1.length;
    }
    return new _Bytes(rt);
  }
  static formatSize(sizeInBytes) {
    const sign = sizeInBytes < 0 ? "-" : "";
    let size = Math.abs(sizeInBytes);
    if (size < 1024)
      return `${sign}${size}bytes`;
    size = size / 1024;
    if (size < 1024)
      return `${sign}${roundToOneDecimal(size)}kb`;
    size = size / 1024;
    return `${sign}${roundToOneDecimal(size)}mb`;
  }
};
let Bytes = _Bytes;
__publicField(Bytes, "EMPTY", new _Bytes(new Uint8Array(0)));
function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}
function base64Encode(buf) {
  let string = "";
  buf.forEach((__byte) => {
    string += String.fromCharCode(__byte);
  });
  return btoa(string);
}
function base64Decode(str, urlSafe) {
  if (urlSafe)
    str = str.replace(/_/g, "/").replace(/-/g, "+");
  str = atob(str);
  const length = str.length, buf = new ArrayBuffer(length), bufView = new Uint8Array(buf);
  for (let i = 0; i < length; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return bufView;
}
function cryptoSubtle() {
  return crypto.subtle;
}
function checkEqual(name, value, expected) {
  if (value !== expected)
    throw new Error(`Bad ${name}: expected ${expected}, found ${value}`);
}
function check(name, value, isValid) {
  const valid = typeof isValid === "boolean" && isValid || typeof isValid === "function" && isValid(value);
  if (!valid)
    throw new Error(`Bad ${name}: ${value}`);
}
class Mqtt {
}
__publicField(Mqtt, "DEBUG", false);
function encodeVariableByteInteger(value) {
  const rt = [];
  do {
    let encodedByte = value % 128;
    value = Math.floor(value / 128);
    if (value > 0) {
      encodedByte = encodedByte | 128;
    }
    rt.push(encodedByte);
  } while (value > 0);
  return rt;
}
function decodeVariableByteInteger(buffer, startIndex) {
  let i = startIndex;
  let encodedByte = 0;
  let value = 0;
  let multiplier = 1;
  do {
    encodedByte = buffer[i++];
    value += (encodedByte & 127) * multiplier;
    if (multiplier > 128 * 128 * 128)
      throw Error("malformed length");
    multiplier *= 128;
  } while ((encodedByte & 128) != 0);
  return {
    value,
    bytesUsed: i - startIndex
  };
}
function encodeUtf8(value) {
  const arr = encoder.encode(value);
  if (arr.length > 65535)
    throw new Error("the maximum size of a UTF-8 Encoded String is 65,535 bytes.");
  const lengthBytes = [
    arr.length >> 8,
    arr.length & 255
  ];
  return [
    ...lengthBytes,
    ...arr
  ];
}
function decodeUtf8(buffer, startIndex) {
  const length = (buffer[startIndex] << 8) + buffer[startIndex + 1];
  const bytes = buffer.slice(startIndex + 2, startIndex + 2 + length);
  const text = decoder.decode(bytes);
  return {
    text,
    bytesUsed: length + 2
  };
}
function hex(bytes) {
  return new Bytes(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).hex();
}
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function readMessage(reader) {
  const { DEBUG } = Mqtt;
  if (reader.remaining() < 2)
    return {
      needsMoreBytes: 2
    };
  const first = reader.readUint8();
  const controlPacketType = first >> 4;
  const controlPacketFlags = first & 15;
  const remainingLength = reader.readVariableByteInteger();
  if (reader.remaining() < remainingLength)
    return {
      needsMoreBytes: remainingLength
    };
  const remainingBytes = reader.readBytes(remainingLength);
  if (DEBUG)
    console.log(`readMessage: ${hex([
      first,
      ...encodeVariableByteInteger(remainingLength),
      ...remainingBytes
    ])}`);
  const messageReader = new Reader(remainingBytes, 0);
  if (controlPacketType === CONNACK)
    return readConnack(messageReader, controlPacketFlags);
  if (controlPacketType === PUBLISH)
    return readPublish(messageReader, controlPacketFlags);
  if (controlPacketType === SUBACK)
    return readSuback(messageReader, controlPacketFlags);
  if (controlPacketType === PINGRESP)
    return readPingresp(messageReader, controlPacketFlags);
  if (controlPacketType === DISCONNECT)
    return readDisconnect(messageReader, controlPacketFlags, remainingLength);
  throw new Error(`readMessage: Unsupported controlPacketType: ${controlPacketType}`);
}
function encodeMessage(message) {
  if (message.type === CONNECT)
    return encodeConnect(message);
  if (message.type === PUBLISH)
    return encodePublish(message);
  if (message.type === SUBSCRIBE)
    return encodeSubscribe(message);
  if (message.type === PINGREQ)
    return encodePingreq(message);
  if (message.type === DISCONNECT)
    return encodeDisconnect(message);
  throw new Error(`encodeMessage: Unsupported controlPacketType: ${message.type}`);
}
function computeControlPacketTypeName(type) {
  if (type === CONNECT)
    return "CONNECT";
  if (type === CONNACK)
    return "CONNACK";
  if (type === PUBLISH)
    return "PUBLISH";
  if (type === SUBSCRIBE)
    return "SUBSCRIBE";
  if (type === SUBACK)
    return "SUBACK";
  if (type === PINGREQ)
    return "PINGREQ";
  if (type === PINGRESP)
    return "PINGRESP";
  if (type === DISCONNECT)
    return "DISCONNECT";
  throw new Error(`computeControlPacketTypeName: Unsupported controlPacketType: ${type}`);
}
const CONNECT = 1;
function encodeConnect(message) {
  const { type, keepAlive, clientId, username, password } = message;
  const connectFlags = (username ? 1 : 0) << 7 | 1 << 6;
  const variableHeader = [
    ...encodeUtf8("MQTT"),
    5,
    connectFlags,
    ...encodeUint16(keepAlive),
    ...encodeVariableByteInteger(0)
  ];
  const payload = [
    ...encodeUtf8(clientId),
    ...username ? encodeUtf8(username) : [],
    ...encodeUtf8(password)
  ];
  return encodePacket(type, {
    variableHeader,
    payload
  });
}
const CONNACK = 2;
function readConnack(reader, controlPacketFlags) {
  const { DEBUG } = Mqtt;
  checkEqual("controlPacketFlags", controlPacketFlags, 0);
  const connectAcknowledgeFlags = reader.readUint8();
  const sessionPresent = (connectAcknowledgeFlags & 1) === 1;
  const connectAcknowledgeFlagsReserved = connectAcknowledgeFlags & 254;
  if (DEBUG)
    console.log({
      sessionPresent,
      connectAcknowledgeFlagsReserved
    });
  checkEqual("connectAcknowledgeFlagsReserved", connectAcknowledgeFlagsReserved, 0);
  let rt = {
    type: 2,
    sessionPresent
  };
  rt = {
    ...rt,
    reason: readReason(reader, CONNACK_REASONS)
  };
  if (reader.remaining() > 0) {
    readProperties(reader, (propertyId) => {
      if (propertyId === 17) {
        const sessionExpiryInterval = reader.readUint32();
        if (DEBUG)
          console.log({
            sessionExpiryInterval
          });
        rt = {
          ...rt,
          sessionExpiryInterval
        };
      } else if (propertyId === 36) {
        const maximumQos = reader.readUint8();
        if (DEBUG)
          console.log({
            maximumQos
          });
        check("maximumQos", maximumQos, maximumQos === 0 || maximumQos === 1);
        rt = {
          ...rt,
          maximumQos
        };
      } else if (propertyId === 37) {
        rt = {
          ...rt,
          retainAvailable: readBooleanProperty("retainAvailable", reader)
        };
      } else if (propertyId === 39) {
        const maximumPacketSize = reader.readUint32();
        if (DEBUG)
          console.log({
            maximumPacketSize
          });
        rt = {
          ...rt,
          maximumPacketSize
        };
      } else if (propertyId === 34) {
        const topicAliasMaximum = reader.readUint16();
        if (DEBUG)
          console.log({
            topicAliasMaximum
          });
        rt = {
          ...rt,
          topicAliasMaximum
        };
      } else if (propertyId === 40) {
        rt = {
          ...rt,
          wildcardSubscriptionAvailable: readBooleanProperty("wildcardSubscriptionAvailable", reader)
        };
      } else if (propertyId === 41) {
        rt = {
          ...rt,
          subscriptionIdentifiersAvailable: readBooleanProperty("subscriptionIdentifiersAvailable", reader)
        };
      } else if (propertyId === 42) {
        rt = {
          ...rt,
          sharedSubscriptionAvailable: readBooleanProperty("sharedSubscriptionAvailable", reader)
        };
      } else if (propertyId === 19) {
        const serverKeepAlive = reader.readUint16();
        if (DEBUG)
          console.log({
            serverKeepAlive
          });
        rt = {
          ...rt,
          serverKeepAlive
        };
      } else if (propertyId === 18) {
        const assignedClientIdentifier = reader.readUtf8();
        if (DEBUG)
          console.log({
            assignedClientIdentifier
          });
        rt = {
          ...rt,
          assignedClientIdentifier
        };
      } else {
        throw new Error(`Unsupported propertyId: ${propertyId}`);
      }
    });
  }
  checkEqual("remaining", reader.remaining(), 0);
  return rt;
}
const CONNACK_REASONS = {
  0: [
    "Success",
    "The Connection is accepted."
  ],
  128: [
    "Unspecified error",
    "The Server does not wish to reveal the reason for the failure, or none of the other Reason Codes apply."
  ],
  129: [
    "Malformed Packet",
    "Data within the CONNECT packet could not be correctly parsed."
  ],
  130: [
    "Protocol Error",
    "Data in the CONNECT packet does not conform to this specification."
  ],
  131: [
    "Implementation specific error",
    "The CONNECT is valid but is not accepted by this Server."
  ],
  132: [
    "Unsupported Protocol Version",
    "The Server does not support the version of the MQTT protocol requested by the Client."
  ],
  133: [
    "Client Identifier not valid",
    "The Client Identifier is a valid string but is not allowed by the Server."
  ],
  134: [
    "Bad User Name or Password",
    "The Server does not accept the User Name or Password specified by the Client"
  ],
  135: [
    "Not authorized",
    "The Client is not authorized to connect."
  ],
  136: [
    "Server unavailable",
    "The MQTT Server is not available."
  ],
  137: [
    "Server busy",
    "The Server is busy. Try again later."
  ],
  138: [
    "Banned",
    "This Client has been banned by administrative action. Contact the server administrator."
  ],
  140: [
    "Bad authentication method",
    "The authentication method is not supported or does not match the authentication method currently in use."
  ],
  144: [
    "Topic Name invalid",
    "The Will Topic Name is not malformed, but is not accepted by this Server."
  ],
  149: [
    "Packet too large",
    "The CONNECT packet exceeded the maximum permissible size."
  ],
  151: [
    "Quota exceeded",
    "An implementation or administrative imposed limit has been exceeded."
  ],
  153: [
    "Payload format invalid",
    "The Will Payload does not match the specified Payload Format Indicator."
  ],
  154: [
    "Retain not supported",
    "The Server does not support retained messages, and Will Retain was set to 1."
  ],
  155: [
    "QoS not supported",
    "The Server does not support the QoS set in Will QoS."
  ],
  156: [
    "Use another server",
    "The Client should temporarily use another server."
  ],
  157: [
    "Server moved",
    "The Client should permanently use another server."
  ],
  159: [
    "Connection rate exceeded",
    "The connection rate limit has been exceeded."
  ]
};
const PUBLISH = 3;
function readPublish(reader, controlPacketFlags) {
  const { DEBUG } = Mqtt;
  checkEqual("controlPacketFlags", controlPacketFlags, 0);
  const dup = (controlPacketFlags & 8) === 8;
  const qosLevel = (controlPacketFlags & 6) >> 1;
  const retain = (controlPacketFlags & 1) === 1;
  if (DEBUG)
    console.log({
      dup,
      qosLevel,
      retain
    });
  if (qosLevel !== 0 && qosLevel !== 1 && qosLevel !== 2)
    throw new Error(`Bad qosLevel: ${qosLevel}`);
  const topic = reader.readUtf8();
  let rt = {
    type: 3,
    dup,
    qosLevel,
    retain,
    topic,
    payload: EMPTY_BYTES
  };
  if (qosLevel === 1 || qosLevel === 2) {
    rt = {
      ...rt,
      packetId: reader.readUint16()
    };
  }
  readProperties(reader, (propertyId) => {
    if (propertyId === 1) {
      const payloadFormatIndicator = reader.readUint8();
      if (DEBUG)
        console.log({
          payloadFormatIndicator
        });
      check("payloadFormatIndicator", payloadFormatIndicator, payloadFormatIndicator === 0 || payloadFormatIndicator === 1);
      rt = {
        ...rt,
        payloadFormatIndicator
      };
    } else if (propertyId === 3) {
      const contentType = reader.readUtf8();
      if (DEBUG)
        console.log({
          contentType
        });
      rt = {
        ...rt,
        contentType
      };
    } else {
      throw new Error(`Unsupported propertyId: ${propertyId}`);
    }
  });
  rt = {
    ...rt,
    payload: reader.readBytes(reader.remaining())
  };
  return rt;
}
function encodePublish(message) {
  const { payloadFormatIndicator, topic, payload, type, dup, qosLevel, retain, packetId, contentType } = message;
  if (qosLevel === 1 || qosLevel === 2) {
    if (packetId === void 0)
      throw new Error(`Missing packetId: required with qosLevel ${qosLevel}`);
  } else if (qosLevel === 0) {
    if (packetId !== void 0)
      throw new Error(`Bad packetId: not applicable with qosLevel 0`);
  } else {
    throw new Error(`Bad qosLevel: ${qosLevel}`);
  }
  const controlPacketFlags = (dup ? 1 << 3 : 0) | qosLevel % 4 << 1 | (retain ? 1 : 0);
  const properties = [
    ...payloadFormatIndicator === void 0 ? [] : [
      1,
      payloadFormatIndicator
    ],
    ...contentType === void 0 ? [] : [
      3,
      ...encodeUtf8(contentType)
    ]
  ];
  const variableHeader = [
    ...encodeUtf8(topic),
    ...packetId === void 0 ? [] : encodeUint16(packetId),
    ...encodeVariableByteInteger(properties.length),
    ...properties
  ];
  return encodePacket(type, {
    controlPacketFlags,
    variableHeader,
    payload
  });
}
const SUBSCRIBE = 8;
function encodeSubscribe(message) {
  const { type, packetId, subscriptions } = message;
  const variableHeader = [
    ...encodeUint16(packetId),
    ...encodeVariableByteInteger(0)
  ];
  const payload = subscriptions.flatMap((v) => [
    ...encodeUtf8(v.topicFilter),
    0
  ]);
  return encodePacket(type, {
    controlPacketFlags: 2,
    variableHeader,
    payload
  });
}
const SUBACK = 9;
function readSuback(reader, controlPacketFlags) {
  checkEqual("controlPacketFlags", controlPacketFlags, 0);
  const packetId = reader.readUint16();
  const rt = {
    type: 9,
    packetId,
    reasons: []
  };
  readProperties(reader, (propertyId) => {
    throw new Error(`Unsupported propertyId: ${propertyId}`);
  });
  while (reader.remaining() > 0) {
    rt.reasons.push(readReason(reader, SUBACK_REASONS));
  }
  return rt;
}
const SUBACK_REASONS = {
  0: [
    "Granted QoS 0",
    "The subscription is accepted and the maximum QoS sent will be QoS 0. This might be a lower QoS than was requested."
  ],
  1: [
    "Granted QoS 1",
    "The subscription is accepted and the maximum QoS sent will be QoS 1. This might be a lower QoS than was requested."
  ],
  2: [
    "Granted QoS 2",
    "The subscription is accepted and any received QoS will be sent to this subscription."
  ],
  128: [
    "Unspecified error",
    "The subscription is not accepted and the Server either does not wish to reveal the reason or none of the other Reason Codes apply."
  ],
  131: [
    "Implementation specific error",
    "The SUBSCRIBE is valid but the Server does not accept it."
  ],
  135: [
    "Not authorized",
    "The Client is not authorized to make this subscription."
  ],
  143: [
    "Topic Filter invalid",
    "The Topic Filter is correctly formed but is not allowed for this Client."
  ],
  145: [
    "Packet Identifier in use",
    "The specified Packet Identifier is already in use."
  ],
  151: [
    "Quota exceeded",
    "An implementation or administrative imposed limit has been exceeded."
  ],
  158: [
    "Shared Subscriptions not supported",
    "The Server does not support Shared Subscriptions for this Client."
  ],
  161: [
    "Subscription Identifiers not supported",
    "The Server does not support Subscription Identifiers; the subscription is not accepted."
  ],
  162: [
    "Wildcard Subscriptions not supported",
    "The Server does not support Wildcard Subscriptions; the subscription is not accepted."
  ]
};
const PINGREQ = 12;
function encodePingreq(message) {
  const { type } = message;
  return encodePacket(type);
}
const PINGRESP = 13;
function readPingresp(reader, controlPacketFlags) {
  checkEqual("controlPacketFlags", controlPacketFlags, 0);
  checkEqual("remaining", reader.remaining(), 0);
  return {
    type: 13
  };
}
const DISCONNECT = 14;
function readDisconnect(reader, controlPacketFlags, remainingLength) {
  checkEqual("controlPacketFlags", controlPacketFlags, 0);
  let rt = {
    type: 14
  };
  if (remainingLength > 0) {
    rt = {
      ...rt,
      reason: readReason(reader, DISCONNECT_REASONS)
    };
  }
  if (remainingLength > 1) {
    readProperties(reader, (propertyId) => {
      throw new Error(`Unsupported propertyId: ${propertyId}`);
    });
  }
  checkEqual("remaining", reader.remaining(), 0);
  return rt;
}
const DISCONNECT_REASONS = {
  0: [
    "Normal disconnection",
    "Close the connection normally. Do not send the Will Message."
  ],
  4: [
    "Disconnect with Will Message",
    "The Client wishes to disconnect but requires that the Server also publishes its Will Message."
  ],
  128: [
    "Unspecified error",
    "The Connection is closed but the sender either does not wish to reveal the reason, or none of the other Reason Codes apply."
  ],
  129: [
    "Malformed Packet",
    "The received packet does not conform to this specification."
  ],
  130: [
    "Protocol Error",
    "An unexpected or out of order packet was received."
  ],
  131: [
    "Implementation specific error",
    "The packet received is valid but cannot be processed by this implementation."
  ],
  135: [
    "Not authorized",
    "The request is not authorized."
  ],
  137: [
    "Server busy",
    "The Server is busy and cannot continue processing requests from this Client."
  ],
  139: [
    "Server shutting down",
    "The Server is shutting down."
  ],
  141: [
    "Keep Alive timeout",
    "The Connection is closed because no packet has been received for 1.5 times the Keepalive time."
  ],
  142: [
    "Session taken over",
    "Another Connection using the same ClientID has connected causing this Connection to be closed."
  ],
  143: [
    "Topic Filter invalid",
    "The Topic Filter is correctly formed, but is not accepted by this Sever."
  ],
  144: [
    "Topic Name invalid",
    "The Topic Name is correctly formed, but is not accepted by this Client or Server."
  ],
  147: [
    "Receive Maximum exceeded",
    "The Client or Server has received more than Receive Maximum publication for which it has not sent PUBACK or PUBCOMP."
  ],
  148: [
    "Topic Alias invalid",
    "The Client or Server has received a PUBLISH packet containing a Topic Alias which is greater than the Maximum Topic Alias it sent in the CONNECT or CONNACK packet."
  ],
  149: [
    "Packet too large",
    "The packet size is greater than Maximum Packet Size for this Client or Server."
  ],
  150: [
    "Message rate too high",
    "The received data rate is too high."
  ],
  151: [
    "Quota exceeded",
    "An implementation or administrative imposed limit has been exceeded."
  ],
  152: [
    "Administrative action",
    "The Connection is closed due to an administrative action."
  ],
  153: [
    "Payload format invalid",
    "The payload format does not match the one specified by the Payload Format Indicator."
  ],
  154: [
    "Retain not supported",
    "The Server has does not support retained messages."
  ],
  155: [
    "QoS not supported",
    "The Client specified a QoS greater than the QoS specified in a Maximum QoS in the CONNACK."
  ],
  156: [
    "Use another server",
    "The Client should temporarily change its Server."
  ],
  157: [
    "Server moved",
    "The Server is moved and the Client should permanently change its server location."
  ],
  158: [
    "Shared Subscriptions not supported",
    "The Server does not support Shared Subscriptions."
  ],
  159: [
    "Connection rate exceeded",
    "This connection is closed because the connection rate is too high."
  ],
  160: [
    "Maximum connect time",
    "The maximum connection time authorized for this connection has been exceeded."
  ],
  161: [
    "Subscription Identifiers not supported",
    "The Server does not support Subscription Identifiers; the subscription is not accepted."
  ],
  162: [
    "Wildcard Subscriptions not supported",
    "The Server does not support Wildcard Subscriptions; the subscription is not accepted."
  ]
};
function encodeDisconnect(message) {
  var _a;
  const { type, reason } = message;
  const reasonCode = (_a = reason == null ? void 0 : reason.code) != null ? _a : 0;
  const variableHeader = [
    reasonCode
  ];
  return encodePacket(type, {
    variableHeader
  });
}
function readReason(reader, table) {
  var _a;
  const { DEBUG } = Mqtt;
  const code = reader.readUint8();
  const [name, description] = (_a = table[code]) != null ? _a : [
    void 0,
    void 0
  ];
  const reason = {
    code,
    name,
    description
  };
  if (DEBUG)
    console.log({
      reason
    });
  return reason;
}
const EMPTY_BYTES = new Uint8Array(0);
function readProperties(reader, handler) {
  const { DEBUG } = Mqtt;
  const propertiesLength = reader.readVariableByteInteger();
  if (DEBUG)
    console.log({
      propertiesLength
    });
  const propertiesEnd = reader.position + propertiesLength;
  while (reader.position < propertiesEnd) {
    const propertyId = reader.readVariableByteInteger();
    if (DEBUG)
      console.log({
        propertyId
      });
    handler(propertyId);
  }
}
function readBooleanProperty(name, reader) {
  const { DEBUG } = Mqtt;
  const value = reader.readUint8();
  if (DEBUG)
    console.log(Object.fromEntries([
      [
        name,
        value
      ]
    ]));
  check(name, value, value === 0 || value === 1);
  return value === 1;
}
function encodeUint16(value) {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint16(0, value);
  return new Uint8Array(buffer);
}
function encodePacket(controlPacketType, opts = {}) {
  const { DEBUG } = Mqtt;
  const { controlPacketFlags = 0, variableHeader = [], payload = [] } = opts;
  const remainingLength = variableHeader.length + payload.length;
  if (DEBUG)
    console.log({
      remainingLength,
      variableHeaderLength: variableHeader.length,
      payloadLength: payload.length
    });
  const fixedHeader = [
    controlPacketType << 4 | controlPacketFlags,
    ...encodeVariableByteInteger(remainingLength)
  ];
  if (DEBUG)
    console.log(`fixedHeader: ${hex(fixedHeader)}`);
  if (DEBUG)
    console.log(`variableHeader: ${hex(variableHeader)}`);
  if (DEBUG)
    console.log(`payload: ${hex(payload)}`);
  const packet = new Uint8Array([
    ...fixedHeader,
    ...variableHeader,
    ...payload
  ]);
  if (DEBUG)
    console.log(`packet: ${hex(packet)}`);
  return packet;
}
class Reader {
  constructor(bytes, offset) {
    __publicField(this, "bytes");
    __publicField(this, "view");
    __publicField(this, "position");
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, offset);
    this.position = offset;
  }
  remaining() {
    return this.bytes.length - this.position;
  }
  readUint8() {
    this.ensureCapacity(1);
    return this.view.getUint8(this.position++);
  }
  readUint32() {
    this.ensureCapacity(4);
    const rt = this.view.getUint32(this.position);
    this.position += 4;
    return rt;
  }
  readUint16() {
    this.ensureCapacity(2);
    const rt = this.view.getUint16(this.position);
    this.position += 2;
    return rt;
  }
  readVariableByteInteger() {
    this.ensureCapacity(1);
    const { value, bytesUsed } = decodeVariableByteInteger(this.bytes, this.position);
    this.position += bytesUsed;
    return value;
  }
  readUtf8() {
    this.ensureCapacity(2);
    const { text, bytesUsed } = decodeUtf8(this.bytes, this.position);
    this.position += bytesUsed;
    return text;
  }
  readBytes(length) {
    this.ensureCapacity(length);
    const rt = this.bytes.slice(this.position, this.position + length);
    this.position += length;
    return rt;
  }
  ensureCapacity(length) {
    const remaining = this.remaining();
    if (remaining < length)
      throw new Error(`reader needs ${length} bytes, has ${remaining} remaining`);
  }
}
class WebSocketConnection {
  constructor(ws) {
    __publicField(this, "completionPromise");
    __publicField(this, "onRead", () => {
    });
    __publicField(this, "ws");
    const { DEBUG } = Mqtt;
    this.ws = ws;
    this.completionPromise = new Promise((resolve, reject) => {
      ws.addEventListener("close", (event) => {
        if (DEBUG)
          console.log("ws close", event);
        resolve();
      });
      ws.addEventListener("error", (event) => {
        var _a;
        if (DEBUG)
          console.log("ws error", event);
        reject((_a = event.message) != null ? _a : event);
      });
    });
    ws.addEventListener("message", async (event) => {
      if (DEBUG)
        console.log("ws message", typeof event.data, event.data);
      if (event.data instanceof Blob) {
        const bytes = new Uint8Array(await event.data.arrayBuffer());
        this.onRead(bytes);
      }
    });
  }
  static create(opts) {
    const { DEBUG } = Mqtt;
    const { hostname, port } = opts;
    const ws = new WebSocket(`wss://${hostname}:${port}`);
    return new Promise((resolve, reject) => {
      let resolved = false;
      ws.addEventListener("open", (event) => {
        if (resolved)
          return;
        if (DEBUG)
          console.log("ws open", event);
        resolved = true;
        resolve(new WebSocketConnection(ws));
      });
      ws.addEventListener("error", (event) => {
        if (resolved)
          return;
        if (DEBUG)
          console.log("ws error", event);
        resolved = true;
        reject(event);
      });
    });
  }
  write(bytes) {
    this.ws.send(bytes);
    return Promise.resolve(bytes.length);
  }
  close() {
    this.ws.close();
  }
}
const MAX_PACKET_IDS = 256 * 256;
const _MqttClient = class {
  constructor(opts) {
    __publicField(this, "hostname");
    __publicField(this, "port");
    __publicField(this, "protocol");
    __publicField(this, "onMqttMessage");
    __publicField(this, "onReceive");
    __publicField(this, "obtainedPacketIds", []);
    __publicField(this, "pendingSubscribes", {});
    __publicField(this, "savedBytes", []);
    __publicField(this, "maxMessagesPerSecond");
    __publicField(this, "connection");
    __publicField(this, "pingTimeout", 0);
    __publicField(this, "keepAliveSeconds", 10);
    __publicField(this, "pendingConnect");
    __publicField(this, "connectionCompletion");
    __publicField(this, "lastSentMessageTime", 0);
    __publicField(this, "receivedDisconnect", false);
    __publicField(this, "clientIdInternal");
    __publicField(this, "nextPacketId", 1);
    const { hostname, port, protocol = "mqtts", maxMessagesPerSecond } = opts;
    this.hostname = hostname;
    this.port = port;
    this.protocol = protocol;
    this.maxMessagesPerSecond = maxMessagesPerSecond;
  }
  get clientId() {
    return this.clientIdInternal;
  }
  get keepAlive() {
    return this.keepAliveSeconds;
  }
  completion() {
    var _a;
    return (_a = this.connectionCompletion) != null ? _a : Promise.resolve();
  }
  connected() {
    return this.connection !== void 0;
  }
  async connect(opts) {
    const { DEBUG } = Mqtt;
    const { clientId = "", username, password, keepAlive = 10 } = opts;
    const { protocol, hostname, port } = this;
    if (!this.connection) {
      this.connection = await _MqttClient.protocolHandlers[protocol]({
        hostname,
        port
      });
      this.connection.onRead = (bytes) => {
        this.processBytes(bytes);
      };
      this.connectionCompletion = this.connection.completionPromise.then(() => {
        if (DEBUG)
          console.log("read loop done");
        this.clearPing();
        this.connection = void 0;
      }, (e) => {
        console.log(`unhandled read loop error: ${e.stack || e}`);
        this.clearPing();
      });
    }
    this.pendingConnect = new Signal();
    this.keepAliveSeconds = keepAlive;
    this.clientIdInternal = clientId;
    await this.sendMessage({
      type: 1,
      clientId,
      username,
      password,
      keepAlive
    });
    return this.pendingConnect.promise;
  }
  async disconnect() {
    await this.sendMessage({
      type: 14,
      reason: {
        code: 0
      }
    });
    this.connection = void 0;
  }
  async publish(opts) {
    const { topic, payload: inputPayload, contentType } = opts;
    const payloadFormatIndicator = typeof inputPayload === "string" ? 1 : 0;
    const payload = typeof inputPayload === "string" ? Bytes.ofUtf8(inputPayload).array() : inputPayload;
    await this.sendMessage({
      type: 3,
      dup: false,
      qosLevel: 0,
      retain: false,
      topic,
      payload,
      payloadFormatIndicator,
      contentType
    });
  }
  async subscribe(opts) {
    const { topicFilter } = opts;
    const packetId = this.obtainPacketId();
    const signal = new Signal();
    this.pendingSubscribes[packetId] = signal;
    await this.sendMessage({
      type: 8,
      packetId,
      subscriptions: [
        {
          topicFilter
        }
      ]
    });
    return signal.promise;
  }
  async ping() {
    await this.sendMessage({
      type: 12
    });
  }
  obtainPacketId() {
    const { DEBUG } = Mqtt;
    const { nextPacketId, obtainedPacketIds } = this;
    for (let i = 0; i < MAX_PACKET_IDS; i++) {
      const candidate = (nextPacketId + i) % MAX_PACKET_IDS;
      if (candidate !== 0 && !obtainedPacketIds.includes(candidate)) {
        obtainedPacketIds.push(candidate);
        if (DEBUG)
          console.log(`Obtained packetId: ${candidate}`);
        this.nextPacketId = (candidate + 1) % MAX_PACKET_IDS;
        return candidate;
      }
    }
    throw new Error(`obtainPacketId: Unable to obtain a packet id`);
  }
  releasePacketId(packetId) {
    const { DEBUG } = Mqtt;
    const { obtainedPacketIds } = this;
    if (packetId < 1 || packetId >= MAX_PACKET_IDS)
      throw new Error(`releasePacketId: Bad packetId: ${packetId}`);
    const i = obtainedPacketIds.indexOf(packetId);
    if (i < 0)
      throw new Error(`releasePacketId: Unobtained packetId: ${packetId}`);
    obtainedPacketIds.splice(i, 1);
    if (DEBUG)
      console.log(`Released packetId: ${packetId}`);
  }
  processBytes(bytes) {
    var _a, _b, _c, _d;
    const { DEBUG } = Mqtt;
    if (this.savedBytes.length > 0) {
      bytes = new Uint8Array([
        ...this.savedBytes,
        ...bytes
      ]);
      this.savedBytes.splice(0);
    }
    if (DEBUG)
      console.log("processBytes", bytes.length + " bytes");
    if (DEBUG)
      console.log(hex(bytes));
    const reader = new Reader(bytes, 0);
    while (reader.remaining() > 0) {
      const start = reader.position;
      const message = readMessage(reader);
      if ("needsMoreBytes" in message) {
        this.savedBytes.push(...bytes.slice(start));
        return;
      }
      if (message.type === 2) {
        if (this.pendingConnect) {
          if (((_b = (_a = message.reason) == null ? void 0 : _a.code) != null ? _b : 0) < 128) {
            this.clientIdInternal = (_c = message.assignedClientIdentifier) != null ? _c : this.clientIdInternal;
            this.keepAliveSeconds = (_d = message.serverKeepAlive) != null ? _d : this.keepAliveSeconds;
            this.reschedulePing();
            this.pendingConnect.resolve();
          } else {
            this.pendingConnect.reject(JSON.stringify(message.reason));
          }
          this.pendingConnect = void 0;
        }
      } else if (message.type === 14) {
        this.receivedDisconnect = true;
        if (this.connection) {
          this.connection.close();
          this.connection = void 0;
        }
      } else if (message.type === 9) {
        const { packetId, reasons } = message;
        this.releasePacketId(packetId);
        const signal = this.pendingSubscribes[packetId];
        if (signal) {
          if (reasons.some((v) => v.code >= 128)) {
            signal.reject(JSON.stringify(reasons));
          } else {
            signal.resolve();
          }
          delete this.pendingSubscribes[packetId];
        }
      } else if (message.type === 13) {
      } else if (message.type === 3) {
        const { topic, payload: messagePayload, payloadFormatIndicator, contentType } = message;
        const payload = payloadFormatIndicator === 1 ? new Bytes(messagePayload).utf8() : messagePayload;
        if (this.onReceive)
          this.onReceive({
            topic,
            payload,
            contentType
          });
      } else {
        throw new Error(`processPacket: Unsupported message type: ${message}`);
      }
      if (this.onMqttMessage)
        this.onMqttMessage(message);
    }
    checkEqual("reader.remaining", reader.remaining(), 0);
  }
  clearPing() {
    clearTimeout(this.pingTimeout);
  }
  reschedulePing() {
    this.clearPing();
    this.pingTimeout = setTimeout(async () => {
      await this.ping();
      this.reschedulePing();
    }, this.keepAliveSeconds * 1e3);
  }
  async sendMessage(message) {
    const { DEBUG } = Mqtt;
    const { connection, maxMessagesPerSecond } = this;
    const diff = Date.now() - this.lastSentMessageTime;
    const intervalMillis = 1e3 / (maxMessagesPerSecond != null ? maxMessagesPerSecond : 1);
    const waitMillis = maxMessagesPerSecond !== void 0 && diff < intervalMillis ? intervalMillis - diff : 0;
    if (DEBUG)
      console.log(`Sending ${computeControlPacketTypeName(message.type)}${waitMillis > 0 ? ` (waiting ${waitMillis}ms)` : ""}`);
    if (waitMillis > 0)
      await sleep(waitMillis);
    if (this.receivedDisconnect)
      throw new Error(`sendMessage: received disconnect`);
    if (!connection)
      throw new Error(`sendMessage: no connection`);
    await connection.write(encodeMessage(message));
    this.lastSentMessageTime = Date.now();
  }
};
let MqttClient = _MqttClient;
__publicField(MqttClient, "protocolHandlers", {
  "mqtts": () => {
    throw new Error(`The 'mqtts' protocol is not supported in this environment`);
  },
  "wss": WebSocketConnection.create
});
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
class Signal {
  constructor() {
    __publicField(this, "promise");
    __publicField(this, "resolve_");
    __publicField(this, "reject_");
    this.promise = new Promise((resolve, reject) => {
      this.resolve_ = resolve;
      this.reject_ = reject;
    });
  }
  resolve() {
    this.resolve_();
  }
  reject(reason) {
    this.reject_(reason);
  }
}
