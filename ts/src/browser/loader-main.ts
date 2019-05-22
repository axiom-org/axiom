// This code is injected into .axiom pages in order to load their actual content.

// TODO: we can't just call window.stop() because that will also stop the content
// script's message listener from running. But it would be more secure to not even display
// anything from the black hole proxy.

// Parcel will automatically insert this variable
declare var process: any;

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
  }
);
