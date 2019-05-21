// The root to display in the sample app.

import * as React from "react";

import AxiomAPI from "./AxiomAPI";
import KeyPair from "../iso/KeyPair";
import TorrentClient from "../iso/TorrentClient";
import TorrentDownloader from "./TorrentDownloader";

import stringify = require("json-stable-stringify");

const NETWORK = "alpha";

export default class App extends React.Component<any, any> {
  axiom: AxiomAPI;

  constructor(props) {
    super(props);

    this.state = {
      publicKey: null,
      balance: null
    };

    this.axiom = new AxiomAPI({ network: NETWORK });
  }

  fetchBlockchainData() {
    this.fetchBalance();
    this.fetchPublicKey();
  }

  async fetchBalance() {
    let user =
      "0x32bbd7e6ffc293bd586953bc2d66aa4f30269e4ab7a084d29f94d2a1fdab9858fe19";

    let account = await this.axiom.getAccount(user);
    if (!account) {
      console.log("no account found for user", user);
      return;
    }

    let balance = account.balance;
    this.setState({
      balance: balance
    });
  }

  async fetchPeerData() {
    let bucket = await this.axiom.getBucket(
      "www",
      "my-cool-example-nonexistent"
    );
    if (!bucket) {
      console.log("bucket is", bucket);
      return;
    }
    await bucket.download();
    console.log("filenames:", await bucket.getFilenames());
    let text = await bucket.getText("index.html");
    console.log("text:", text);
  }

  async createBucket() {
    try {
      let bucket = await this.axiom.createBucket("testapp", "mybucket", 1);
      console.log("bucket:", bucket);
    } catch (e) {
      console.log("error:", e);
    }
  }

  async updateBucket() {
    let bucket = await this.axiom.getBucket("testapp", "mybucket");
    if (!bucket) {
      console.log("bucket doesn't exist, create it first");
      return;
    }
    let data = await bucket.getJSON("foo.json");
    console.log("got bucket data:", data);
    if (!data) {
      data = { lucky: 1 };
    } else {
      data.lucky += 1;
    }
    console.log("setting data to", data);
    bucket.setJSON("foo.json", data);
    await bucket.upload();
    console.log("upload complete");
  }

  async fetchPublicKey() {
    console.log("calling getPublicKey");
    let pk = await this.axiom.getPublicKey();
    console.log("getPublicKey completed, it's", pk);
    this.setState({
      publicKey: pk
    });
  }

  login(privateKey) {
    // TODO: validate
    this.setState({ keyPair: KeyPair.fromPrivateKey(privateKey) });
  }

  render() {
    return (
      <div>
        <h1>this is the sample app</h1>
        <h1>
          {this.state.publicKey ? this.state.publicKey : "nobody"} is logged in
        </h1>
        <h1>
          the test user balance is{" "}
          {this.state.balance == null ? "unknown" : this.state.balance}
        </h1>
        <button
          onClick={() => {
            this.fetchBlockchainData();
          }}
        >
          Fetch Blockchain Data
        </button>
        <hr />
        <button
          onClick={() => {
            this.fetchPeerData();
          }}
        >
          Fetch Peer Data
        </button>
        <hr />
        <button
          onClick={() => {
            this.createBucket();
          }}
        >
          Create Bucket
        </button>
        <hr />
        <button
          onClick={() => {
            this.updateBucket();
          }}
        >
          Update Bucket
        </button>
        <hr />
        <a href="http://my-cool-example.axiom">Hello</a>
      </div>
    );
  }
}
