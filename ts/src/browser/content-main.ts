// This code runs in our content script, in the context of every web page.
// It does not run in the context of web pages that failed to load.
// It does not run in .axiom pages because the loader stops subsequent page loading.

// console.log("running content-main.ts");

window.addEventListener(
  "message",
  event => {
    if (event.source != window || event.data.type != "toAxiom") {
      return;
    }

    chrome.runtime.sendMessage(
      { TrustedClient: event.data.message },
      response => {
        let data = {
          id: event.data.id,
          type: "fromAxiom",
          message: response
        };
        window.postMessage(data, "*");
      }
    );
  },
  false
);
