import stringify = require("json-stable-stringify");

// Used to communicate with the blockchain
export default class Message {
  type: string;
  _serialized: string;

  constructor(type: string, properties = {}) {
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

  static fromSerialized(serialized): any {
    let { type, message } = JSON.parse(serialized);
    return new Message(type, message);
  }
}
