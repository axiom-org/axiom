import * as React from "react";
import * as ReactDOM from "react-dom";
import { Provider } from "react-redux";
import "typeface-roboto";

import Popup from "./Popup";
import Storage from "./Storage";

// This code runs to load the popup of the chrome extension.
async function onload() {
  let store = await Storage.makeStore();

  ReactDOM.render(
    <Provider store={store}>
      <Popup />
    </Provider>,
    document.getElementById("root")
  );
}

window.onload = onload;
