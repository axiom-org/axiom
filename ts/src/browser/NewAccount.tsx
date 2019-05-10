// A screen to let the user create a new account.

import * as React from "react";

export default class NewAccount extends React.Component<any, any> {
  popup: any;

  // props.popup is a reference to the root popup
  constructor(props) {
    super(props);

    this.popup = props.popup;
  }

  render() {
    return <div>TODO</div>;
  }
}
