// A wrapper for local storage.

export default class LocalStorage {
  // Resolves to null if there is no data
  async get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], result => {
        resolve(result[key]);
      });
    });
  }

  async set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ key, value }, () => {
        resolve();
      });
    });
  }
}
