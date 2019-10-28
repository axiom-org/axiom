import stringify = require("json-stable-stringify");

// Used to communicate with the blockchain
export default class Message {
  type: string;
  _serialized: string;
  [key: string]: any;

  constructor(type: string, properties: any = {}) {
    this.type = type;
    this._serialized = stringify({
      type,
      message: properties
    });
    for (let key in properties) {
      this[key] = properties[key];
    }
  }

  serialize() {
    return this._serialized;
  }

  static fromSerialized(serialized: string): Message {
    let { type, message } = JSON.parse(serialized);
    return new Message(type, message);
  }
}
