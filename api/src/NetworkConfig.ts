// A NetworkConfig object specifies how to connect to a particular network.
// Each standard network config has a string name.
// Currently supported are:
// local: the local network on your machine for testing
// prod: the production network
// "alpha" is an old name for prod.
export default class NetworkConfig {
  name: string;
  bootstrap: string[];

  constructor(name: string) {
    this.name = name;
    if (name == "local") {
      this.bootstrap = ["ws://localhost:3500"];
    } else if (name == "alpha" || name == "prod") {
      this.bootstrap = [
        "wss://0.axiombootstrap.com",
        "wss://1.axiombootstrap.com",
        "wss://2.axiombootstrap.com",
        "wss://3.axiombootstrap.com"
      ];
    } else {
      throw new Error("unrecognized network config name: " + name);
    }
  }
}
