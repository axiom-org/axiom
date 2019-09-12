import Database from "./Database";
import { useTestEnvironment, useNormalEnvironment } from "./TestUtil";

beforeEach(useTestEnvironment);
afterEach(useNormalEnvironment);

test("Database basics", async () => {
  let database = new Database("testchannel", "testdatabase");
  let callback = jest.fn();
  await database.onMessage(callback);
  await database.create({ foo: "bar" });
  expect(callback.mock.calls.length).toBe(1);

  let database2 = new Database("testchannel", "testdatabase");
  let callback2 = jest.fn();
  await database2.onMessage(callback2);
  await database2.create({ baz: "qux" });
  expect(callback2.mock.calls.length).toBe(2);
});
