// A screen to show the status of your account.

import * as React from "react";
import Button from "@material-ui/core/Button";

import Styles from "./Styles";
import TrustedClient from "./TrustedClient";

export default class Status extends React.Component<any, any> {
  constructor(props) {
    super(props);
    this.state = {
      balance: null
    };

    TrustedClient.get()
      .balance()
      .then(balance => {
        this.setState({ balance: balance });
      });
  }

  // props.popup is a reference to the root popup
  // props.keyPair is the key pair
  render() {
    return (
      <div style={Styles.popup}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-evenly",
            width: "100%",
            flex: 3
          }}
        >
          <h1>Status</h1>
          <div>
            Public key:
            <div
              style={{
                wordWrap: "break-word"
              }}
            >
              {this.props.keyPair.getPublicKey()}
            </div>
          </div>
          <div>
            Balance:
            <div>
              {this.state.balance == null ? "loading..." : this.state.balance}
            </div>
          </div>
        </div>
        <div
          style={{
            flex: 2,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            justifyContent: "space-evenly"
          }}
        >
          <Button
            variant="contained"
            color="default"
            onClick={() => {
              this.props.popup.logOut();
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    );
  }
}
