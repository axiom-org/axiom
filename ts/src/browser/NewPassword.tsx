// A screen to let the user create a password to locally encrypt keys.

import * as React from "react";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";

import Styles from "./Styles";

export default class NewPassword extends React.Component<any, any> {
  popup: any;
  passwordField: any;
  repeatPasswordField: any;

  // props.popup is a reference to the root popup
  constructor(props) {
    super(props);

    this.popup = props.popup;

    this.state = {
      password: "",
      repeatPassword: "",
      warning: false
    };
  }

  render() {
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
          <h1>Choose a password</h1>
          <p>
            This password prevents other people using this computer from using
            your Axiom account. This password isn't useful to people who aren't
            using this computer, so it can be short.
          </p>
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

            if (this.state.password == "") {
              this.passwordField.focus();
              return;
            }

            if (this.state.repeatPassword == "") {
              this.repeatPasswordField.focus();
              return;
            }

            if (this.state.password != this.state.repeatPassword) {
              this.setState({
                repeatPassword: "",
                warning: true
              });
              this.repeatPasswordField.focus();
              return;
            }

            this.popup.newPassword(this.state.password);
          }}
        >
          <TextField
            label="Password"
            type="password"
            InputLabelProps={{ shrink: true }}
            autoFocus={true}
            value={this.state.password}
            onChange={event => {
              this.setState({
                password: event.target.value
              });
            }}
            inputRef={input => (this.passwordField = input)}
          />
          <TextField
            label={
              this.state.warning
                ? "Passwords must match"
                : "Repeat your password"
            }
            type="password"
            InputLabelProps={{ shrink: true }}
            value={this.state.repeatPassword}
            error={this.state.warning}
            onChange={event => {
              this.setState({
                repeatPassword: event.target.value
              });
            }}
            inputRef={input => (this.repeatPasswordField = input)}
          />
          <Button variant="contained" color="primary" type="submit">
            Create Password
          </Button>
        </form>
      </div>
    );
  }
}
