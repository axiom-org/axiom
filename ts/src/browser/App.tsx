// The root to display in the sample app.

import * as React from "react";

import AxiomAPI from "./AxiomAPI";
import KeyPair from "../iso/KeyPair";

const NETWORK = "alpha";

export default class App extends React.Component<any, any> {
  axiom: AxiomAPI;

  constructor(props) {
    super(props);

    this.state = {
      lines: ["foo", "bar"]
    };

    this.axiom = new AxiomAPI({ network: NETWORK, verbose: true });
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
