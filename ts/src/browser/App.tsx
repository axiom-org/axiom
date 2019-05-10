// The root to display in the sample app.

import * as React from "react";

import UntrustedClient from "./UntrustedClient";
import KeyPair from "../iso/KeyPair";
import TorrentClient from "../iso/TorrentClient";
import TorrentDownloader from "./TorrentDownloader";

import stringify = require("json-stable-stringify");

async function fetchPeerData() {
  // localStorage.debug = "webtorrent:torrent";
  const SAMPLESITE =
    "magnet:?xt=urn:btih:e60f82343019bd711c5c731b46e118b0f2b2ecc6&dn=samplesite&tr=ws%3A%2F%2Flocalhost%3A4000&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com";

  let client = new TorrentClient("local");
  let torrent = await client.download(SAMPLESITE);
  await torrent.monitorProgress();
  await client.destroy();
}

export default class App extends React.Component<any, any> {
  client: UntrustedClient;

  constructor(props) {
    super(props);

    this.state = {
      publicKey: null,
      mintBalance: null
    };

    this.client = new UntrustedClient();
  }

  fetchBlockchainData() {
    // this.fetchBalance();
    // this.fetchPublicKey();
    console.log(stringify);
    console.log(stringify({ b: 2, a: 1 }));
  }

  async fetchBalance() {
    let mint =
      "0x32652ebe42a8d56314b8b11abf51c01916a238920c1f16db597ee87374515f4609d3";
    let query = {
      account: mint
    };

    let response = await this.client.query(query);
    if (!response.accounts || !response.accounts[mint]) {
      console.log("bad message:", response);
    } else {
      let balance = response.accounts[mint].balance;
      this.setState({
        mintBalance: balance
      });
    }
  }

  async fetchPublicKey() {
    let pk = await this.client.getPublicKey();
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
          mint balance is{" "}
          {this.state.mintBalance == null ? "unknown" : this.state.mintBalance}
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
            fetchPeerData();
          }}
        >
          Fetch Peer Data
        </button>
        <hr />
        <a href="http://hello.axiom">Hello</a>
      </div>
    );
  }
}
