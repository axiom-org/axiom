// This code is injected into .axiom pages in order to load their actual content.

import { routeWindowMessages } from "./WindowUtil";

// Parcel will automatically insert this variable
declare var process: any;

window.stop();

document.write("loading...");

console.log("loading from", process.env.NETWORK, "network begins");

chrome.runtime.sendMessage(
  {
    getFile: {
      hostname: window.location.hostname,
      pathname: window.location.pathname
    }
  },
  response => {
    console.log("loading from", process.env.NETWORK, "network complete");
    document.open();
    if (!response) {
      document.write(
        "error: received empty response from extension. check extension logs"
      );
      return;
    }
    if (response.error) {
      document.write("error: " + response.error);
    } else {
      document.write(response);
    }

    routeWindowMessages();
  }
);
