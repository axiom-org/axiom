// A Sequence is like a list that can be asynchronously populated.
// You can then iterate over it without worrying about whether it has
// been populated yet, or not.
export default class Sequence<T> {
  items: T[];
  callbacks: ((T) => void)[];

  constructor() {
    this.items = [];
    this.callbacks = [];
  }

  push(item: T) {
    if (!this.callbacks) {
      throw new Error("cannot push after finish");
    }
    this.items.push(item);
    for (let callback of this.callbacks) {
      callback(item);
    }
  }

  forEach(callback: (T) => void) {
    for (let item of this.items) {
      callback(item);
    }
    this.callbacks.push(callback);
  }

  // Releases the callbacks so that garbage collection can clean them up
  finish() {
    this.callbacks = null;
  }
}
