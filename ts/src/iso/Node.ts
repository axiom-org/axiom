// A Node represents a member of the Axiom peer-to-peer network.
export default class Node {
  verbose: boolean;

  constructor(verbose: boolean) {
    this.verbose = verbose;
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }
}
