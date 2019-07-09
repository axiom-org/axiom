// The root to display in the sample app.

import * as React from "react";

import AxiomAPI from "./AxiomAPI";
import KeyPair from "../iso/KeyPair";
import Node from "../iso/Node";
import { sleep } from "../iso/Util";

const NETWORK = "alpha";

function reversed(arr) {
  let answer = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    answer.push(arr[i]);
  }
  return answer;
}

export default class App extends React.Component<any, any> {
  axiom: AxiomAPI;

  constructor(props) {
    super(props);

    this.state = {
      lines: [`connecting to ${NETWORK} network`]
    };

    this.axiom = new AxiomAPI({ network: NETWORK, verbose: true });
    let node = this.axiom.createNode();
    this.pipeLines(node);
  }

  addLine(line: string) {
    this.setState({ lines: this.state.lines.concat(line) });
  }

  async pipeLines(node: Node) {
    while (true) {
      await sleep(2000);
      this.addLine(node.statusLine());
    }
  }

  render() {
    return (
      <div>
        <h1>p2p network scanner</h1>
        {reversed(this.state.lines).map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    );
  }
}
