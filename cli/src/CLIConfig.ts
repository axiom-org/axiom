import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { KeyPair } from "axiom-api";
import { isDirectory, isFile } from "./FileUtil";

// An object that keeps itself synced to disk.
// The serialized form may contain these fields:
// keyPair: a plain-object keypair
// network: which network to point to. either "local" or "alpha".
export default class CLIConfig {
  data: {
    keyPair?: KeyPair;
    network?: string;
  };
  filename: string;

  constructor() {
    // If the directory doesn't exist, create it
    let dir = path.join(os.homedir(), ".axiom");
    if (!isDirectory(dir)) {
      fs.mkdirSync(dir);
    }

    this.filename = path.join(dir, "config.json");

    if (isFile(this.filename)) {
      // If the config file exists, read it
      let str = fs.readFileSync(this.filename, "utf8");
      this.data = JSON.parse(str);
    } else {
      // If the config file does not exist, create it
      this.data = {};
      this.write();
    }
  }

  getNetwork() {
    if (!this.data.network) {
      // Defaults to alpha.
      return "alpha";
    }

    return this.data.network;
  }

  setNetwork(network) {
    if (network == this.getNetwork()) {
      return;
    }

    // Check that the network is valid
    // TODO: figure out whether to export this from axiom-api
    // new NetworkConfig(network);

    // Changing the network also logs us out
    this.data.network = network;
    this.data.keyPair = null;
    this.write();
  }

  getKeyPair() {
    if (!this.data.keyPair) {
      return null;
    }
    return KeyPair.fromPlain(this.data.keyPair);
  }

  setKeyPair(kp) {
    this.data.keyPair = kp.plain();
    this.write();
  }

  logout() {
    this.data.keyPair = null;
    this.write();
  }

  write() {
    let pretty = JSON.stringify(this.data, null, 2) + "\n";
    fs.writeFileSync(this.filename, pretty);
  }
}
