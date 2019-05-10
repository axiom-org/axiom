// This code is injected into .axiom pages in order to load their actual content.

// Stops the process of loading the nonexistent .axiom url
window.stop();

// It makes the UI more comprehensible to show something new, rather
// than whatever document was previously shown in the browser. Making
// this empty just causes the browser to not show anything yet.
document.write("loading...");

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
