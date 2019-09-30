import Database from "./Database";
import KeyPair from "./KeyPair";
import { useTestEnvironment, useNormalEnvironment } from "./TestUtil";

beforeEach(useTestEnvironment);
afterEach(useNormalEnvironment);

test("Database basics", async () => {
  let chan: any = {
    name: "testdatabase",
    getKeyPair: () => {
      let kp = KeyPair.fromRandom();
      return kp;
    }
  };
  let database1 = new Database("testchannel", chan);
  let callback1 = jest.fn();
  await database1.onMessage(callback1);
  let fooID = await database1.create({ foo: "bar" });
  expect(callback1.mock.calls.length).toBe(1);

  // These Database objects aren't communicating; they are reloading
  // the same data from the persistent store.
  let database2 = new Database("testchannel", chan);
  let callback2 = jest.fn();
  await database2.onMessage(callback2);
  await database2.create({ baz: "qux" });
  expect(callback2.mock.calls.length).toBe(2);

  await database2.update(fooID, { foo: "bar2" });
  expect(callback2.mock.calls.length).toBe(3);

  await database2.delete(fooID);
  expect(callback2.mock.calls.length).toBe(4);
});
