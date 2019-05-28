// A screen for an app to request permissions from the user.

import * as React from "react";
import Button from "@material-ui/core/Button";

import Styles from "./Styles";

export default class RequestPermission extends React.Component<any, any> {
  // props.host is the entity requesting permissions
  // props.permissions is the permissions we are requesting
  // props.accept is what we call when the user accepts
  // props.deny is what we call when the user denies
  constructor(props) {
    super(props);
  }

  // Return a list of human-readable strings for the permissions we want
  permissionList() {
    let permissions = this.props.permissions;
    let answer = [];
    if (permissions.publicKey) {
      answer.push("to know your public identity");
    }
    if (permissions.createBucket) {
      for (let { name, size } of permissions.createBucket) {
        answer.push(`to create a ${size}MB bucket named ${name}`);
      }
    }
    if (permissions.updateBucket) {
      for (let { name } of permissions.updateBucket) {
        answer.push(`to write to ${name}`);
      }
    }
    return answer;
  }

  render() {
    return (
      <div style={Styles.popup}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            wordWrap: "break-word",
            width: "100%",
            flex: 3
          }}
        >
          <h1>Grant Permission?</h1>
          <h2>{this.props.host} requests:</h2>
          <ol>
            {this.permissionList().map(x => (
              <li key={x}>{x}</li>
            ))}
          </ol>
        </div>

        <div
          style={{
            flex: 2,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            justifyContent: "space-evenly"
          }}
          onSubmit={event => {
            event.preventDefault();
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={() => this.props.accept()}
          >
            Accept
          </Button>
          <Button
            variant="contained"
            color="default"
            onClick={() => this.props.deny()}
          >
            Deny
          </Button>
        </div>
      </div>
    );
  }
}
