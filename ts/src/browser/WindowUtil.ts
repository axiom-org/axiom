// This should be called once from a context owned by the extension, for any
// page that is going to use the Axiom API.
export function routeWindowMessages() {
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
}
