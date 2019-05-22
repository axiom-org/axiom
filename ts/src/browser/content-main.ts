// This code runs in our content script, in the context of every web page.
// It does not run in the context of web pages that failed to load.

console.log("XXX content-main");
console.log("XXX c-m window.location.href", window.location.href);
console.log("XXX c-m window.origin", window.origin);

window.addEventListener(
  "message",
  event => {
    console.log("XXX event:", event);

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
