import * as fs from "fs";

import { isFile } from "./FileUtil";

// A config object that maps to a json config file.
export default class HostingConfig {
  // Which network to point to.
  // Either "local" or "prod". Defaults to "prod".
  network: string;

  // What channel to connect to.
  channel?: string;

  // What databases to host.
  databases: string[];

  // Construct a new HostingConfig from its serialized form.
  constructor(json: any) {
    this.network = json.network || "prod";
    this.channel = json.channel;
    this.databases = json.databases;
  }

  static fromFile(filename: string): HostingConfig {
    if (!isFile(filename)) {
      throw new Error(`no such file: ${filename}`);
    }
    let str = fs.readFileSync(filename, "utf8");
    let json = JSON.parse(str);
    return new HostingConfig(json);
  }
}
