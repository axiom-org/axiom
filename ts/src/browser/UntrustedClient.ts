import Message from "../iso/Message";
import { missingPermissions, hasPermission } from "./Permission";

// Client is designed to be included in applications and run in an untrusted application
// environment. It gets permissions by requesting them from the extension, whose code
// is trusted.
//
// There are two types of messages - browser messages are used to communicate between
// application page, content script, and other extension logic. The Message object is used
// to communicate with the blockchain.
//
// Browser messages are plain json that contains:
// id: a random id string specifying this message
// type: either "toCoinkit" or "fromCoinkit" for whether it is upstream or downstream
// message: a serialized blockchain message
//
// When the extension sends a response message, it includes the same id as the message
// that it was responding to.

export default class UntrustedClient {
  publicKey: string;
  callbacks: { [id: string]: any };
  permissions: any;
  popupURL: string;

  constructor() {
    // publicKey is null before permissions are acquired
    this.publicKey = null;

    // Callbacks are keyed by message id
    this.callbacks = {};

    // We store the most recent permission message we received from the extension.
    // Before we receive any permission message, we just assume we have no permissions.
    this.permissions = {};

    // Where to ask about new permissions
    this.popupURL = null;

    window.addEventListener("message", event => {
      if (
        event.source != window ||
        event.data.type != "fromCoinkit" ||
        !event.data.message
      ) {
        return;
      }

      let message = Message.fromSerialized(event.data.message);

      if (message.type == "Permission") {
        this.permissions = message.permissions;
        this.popupURL = message.popupURL;
      }

      let callback = this.callbacks[event.data.id];
      delete this.callbacks[event.data.id];
      if (!callback) {
        return;
      }

      callback(message);
    });

    // Initialize the permissions by asking the extension for what we have
    this.sendMessage(new Message("RequestPermission", { permissions: {} }));
  }

  // Each browser message has an id
  getMessageId() {
    return "" + Math.random();
  }

  async sendMessage(message): Promise<any> {
    let id = this.getMessageId();
    let data = {
      id: id,
      type: "toCoinkit",
      message: message.serialize()
    };
    return new Promise((resolve, reject) => {
      this.callbacks[id] = resolve;
      window.postMessage(data, "*");
    });
  }

  // Returns whether the app has a set of permissions.
  // It is possible that there is a race condition where permissions change between the
  // time that permissions were stored locally and the time a request actually happens.
  // Thus a properly written application still needs to handle the case
  // where hasPermission returns true, but the request itself gets rejected for a
  // permissions failure.
  hasPermission(permissions) {
    return hasPermission(this.permissions, permissions);
  }

  // Request the permissions that we do not already have, out of the provided set.
  // This returns immediately if we already have the requested permissions, and creates
  // a popup if the user needs to approve.
  // Since it might create a popup, the application should call requestPermission as
  // a direct response to a user action, so that the popup does not get hidden.
  // Typically this is handling a click on a "log in" button.
  //
  // Returns a permission message containing all the permissions we have.
  // Throws an error if the user denies permission.
  async requestPermission(permissions) {
    if (this.hasPermission(permissions)) {
      return new Message("Permission", { permissions: this.permissions });
    }

    if (!this.popupURL) {
      return new Message("Error", {
        error: "Client popupURL was not initialized"
      });
    }

    // We need to prompt the user for approval
    window.open(this.popupURL, "", "height=580,width=376,top=100,left=100");

    return await this.sendMessage(
      new Message("RequestPermission", { permissions: permissions })
    );
  }

  // Requests public key permission from the extension if we don't already have it.
  // Throws an error if the user denies permission.
  async getPublicKey() {
    if (!hasPermission(this.permissions, { publicKey: true })) {
      await this.requestPermission({ publicKey: true });
    }
    let message = new Message("Query", { publicKey: true });
    let response = await this.sendMessage(message);
    this.publicKey = response.publicKey;
    return this.publicKey;
  }

  // Sends a query message, given the query properties.
  // Returns a promise for a message - a data message if the query worked, an error
  // message if it did not.
  async query(properties) {
    let message = new Message("Query", properties);
    return this.sendMessage(message);
  }
}
