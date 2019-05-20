// A screen to prompt a login.

import * as React from "react";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";

import KeyPair from "../iso/KeyPair";
import Styles from "./Styles";

export default class Login extends React.Component<any, any> {
  popup: any;

  // props.popup is a reference to the root popup
  constructor(props) {
    super(props);

    this.popup = props.popup;

    this.state = {
      error: false,
      input: ""
    };
  }

  // Returns whether the private key is valid.
  // If it is valid, calls the callback on the associated keypair.
  setPrivateKey(privateKey) {
    let kp = null;
    try {
      kp = KeyPair.fromPrivateKey(privateKey);
    } catch (e) {
      return false;
    }
    this.popup.newKeyPair(kp);
    return true;
  }

  // this.state.input could be a password or private key
  handleInput() {
    // Check if the input was a private key
    let kp;
    try {
      kp = KeyPair.fromPrivateKey(this.state.input);
    } catch (e) {
      // It's not a valid private key
      console.log(
        "the string: [" + this.state.input + "] is not a valid private key"
      );
    }
    if (kp) {
      this.popup.newKeyPair(kp);
      return;
    }

    // Check if the input was a password
    this.popup.checkPassword(this.state.input).then(ok => {
      if (!ok) {
        this.setState({
          error: true,
          input: ""
        });
      }
    });
  }

  render() {
    let allowCreateNewAccount = false;
    return (
      <div style={Styles.popup}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 3
          }}
        >
          <h1>Login</h1>
        </div>
        <form
          style={{
            flex: 2,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            justifyContent: "space-evenly"
          }}
          onSubmit={event => {
            event.preventDefault();
            this.handleInput();
          }}
        >
          <TextField
            error={this.state.error}
            label={
              this.state.error ? "Invalid password" : "Password or private key"
            }
            type="password"
            value={this.state.input}
            autoFocus={true}
            onChange={event => {
              this.setState({
                input: event.target.value
              });
            }}
          />
          <Button variant="contained" color="primary" type="submit">
            Log In
          </Button>

          {allowCreateNewAccount && (
            <Button
              variant="contained"
              color="default"
              onClick={() => {
                this.popup.newKeyPair(KeyPair.fromRandom());
              }}
            >
              Create a new account
            </Button>
          )}
        </form>
      </div>
    );
  }
}
