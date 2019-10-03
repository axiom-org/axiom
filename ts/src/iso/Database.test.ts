import Database from "./Database";
import KeyPair from "./KeyPair";
import Message from "./Message";
import SignedMessage from "./SignedMessage";
import { useTestEnvironment, useNormalEnvironment } from "./TestUtil";

beforeEach(useTestEnvironment);
afterEach(useNormalEnvironment);

// Mocks
let KP = KeyPair.fromRandom();
let CHAN: any = {
  name: "testdatabase",
  getKeyPair: () => KP
};

test("Database object format conversion", async () => {
  let db = new Database("testchannel", CHAN);
  let message = new Message("Update", {
    channel: CHAN.name,
    database: db.name,
    timestamp: new Date().toISOString(),
    name: "myname",
    data: { foo: "bar" }
  });
  let sm = SignedMessage.fromSigning(message, KP);

  let doc = db.signedMessageToDocument(sm);
  let sm2 = db.documentToSignedMessage(doc);
  expect(sm2).toEqual(sm);
});

test("Database basics", async () => {
  let database1 = new Database("testchannel", CHAN);
  let callback1 = jest.fn();
  await database1.onMessage(callback1);
  let fooID = await database1.create({ foo: "bar" });
  expect(callback1.mock.calls.length).toBe(1);

  // These Database objects aren't communicating; they are reloading
  // the same data from the persistent store.
  let database2 = new Database("testchannel", CHAN);
  let callback2 = jest.fn();
  await database2.onMessage(callback2);
  await database2.create({ baz: "qux" });
  expect(callback2.mock.calls.length).toBe(2);

  await database2.update(fooID, { foo: "bar2" });
  expect(callback2.mock.calls.length).toBe(3);

  await database2.delete(fooID);
  expect(callback2.mock.calls.length).toBe(4);

  let objects = await database2.find({ selector: {} });
  expect(objects.length).toBe(1);
});
