// The root to display in the sample app.

import * as React from "react";

import AxiomAPI from "./AxiomAPI";
import KeyPair from "../iso/KeyPair";
import Node from "../iso/Node";

const NETWORK = "alpha";

const URL = "ws://0.alphatest.network:3500";

export default class App extends React.Component<any, any> {
  axiom: AxiomAPI;

  constructor(props) {
    super(props);

    this.state = {
      lines: [`connecting to ${URL}`]
    };

    // this.axiom = new AxiomAPI({ network: NETWORK, verbose: true });
    let node = new Node(null, [URL], true);
    this.pipeLines(node);
  }

  addLine(line: string) {
    this.setState({ lines: this.state.lines.concat(line) });
  }

  async pipeLines(node: Node) {
    while (true) {
      if (!this.isMounted()) {
        return;
      }
      await sleep(1000);
      this.addLine(node.statusLine());
    }
  }

  render() {
    return (
      <div>
        <h1>this is the sample app</h1>
        {this.state.lines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    );
  }
}
