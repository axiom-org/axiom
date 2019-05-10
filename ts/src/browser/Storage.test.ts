import KeyPair from "../iso/KeyPair";
import MockLocalStorage from "./MockLocalStorage";
import Storage from "./Storage";

import { newKeyPair, newPassword } from "./Actions";

test("basic redux store usage", async () => {
  let local = new MockLocalStorage();
  Storage.mock = new Storage(local);

  expect(local.numKeys()).toBe(0);

  // Make a redux state with a new user
  let store1 = await Storage.makeStore();
  let kp = KeyPair.fromRandom();
  store1.dispatch(newKeyPair(kp));
  expect(local.numKeys()).toBe(0);
  store1.dispatch(newPassword("monkey"));
  expect(local.numKeys()).toBe(1);
  let state1 = store1.getState();

  // Re-make that state from storage
  let store2 = await Storage.makeStore();
  let state2 = store2.getState();
  expect(state2).toEqual(state1);
});
