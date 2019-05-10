import * as React from "react";
import * as ReactDOM from "react-dom";

import App from "./App";

// This code runs at the root of our sample app.

window.onload = () => {
  ReactDOM.render(<App />, document.getElementById("root"));
};
