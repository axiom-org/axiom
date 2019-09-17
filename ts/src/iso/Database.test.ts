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
  let database = new Database("testchannel", chan);
  let callback = jest.fn();
  await database.onMessage(callback);
  await database.create({ foo: "bar" });
  expect(callback.mock.calls.length).toBe(1);

  let database2 = new Database("testchannel", chan);
  let callback2 = jest.fn();
  await database2.onMessage(callback2);
  await database2.create({ baz: "qux" });
  expect(callback2.mock.calls.length).toBe(2);
});
