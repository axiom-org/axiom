// A NetworkConfig object specifies how to connect to a particular network.
// Each standard network config has a string name.
// Currently supported are:
// local: the local network on your machine for testing
// alpha: the alpha test network running under alphatest.network
export default class NetworkConfig {
  name: string;
  chain: string[];
  trackers: string[];
  proxies: string[];
  bootstrap: string[];

  // A negative number means no limit
  retries: number;

  constructor(name) {
    this.name = name;
    if (name == "local") {
      this.chain = [
        "http://localhost:8000",
        "http://localhost:8001",
        "http://localhost:8002",
        "http://localhost:8003"
      ];
      this.trackers = ["ws://localhost:4000"];
      this.proxies = ["localhost:3000"];
      this.bootstrap = ["ws://localhost:3500"];
      this.retries = 3;
    } else if (name == "alpha") {
      this.chain = [
        "http://0.alphatest.network:8000",
        "http://1.alphatest.network:8000",
        "http://2.alphatest.network:8000",
        "http://3.alphatest.network:8000"
      ];
      this.trackers = [
        "ws://0.alphatest.network:4000",
        "ws://1.alphatest.network:4000",
        "ws://2.alphatest.network:4000",
        "ws://3.alphatest.network:4000"
      ];
      this.proxies = [
        "0.alphatest.network:3000",
        "1.alphatest.network:3000",
        "2.alphatest.network:3000",
        "3.alphatest.network:3000"
      ];
      this.bootstrap = [
        "wss://h0.alphatest.network",
        "wss://h1.alphatest.network",
        "wss://h2.alphatest.network",
        "wss://h3.alphatest.network"
      ];
      this.retries = -1;
    } else {
      throw new Error("unrecognized network config name: " + name);
    }
  }

  getChain() {
    return randomChoice(this.chain);
  }

  getProxy() {
    return randomChoice(this.proxies);
  }
}

function randomChoice(list) {
  let i = Math.floor(list.length * Math.random());
  return list[i];
}
