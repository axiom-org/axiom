import Database from "./Database";

beforeEach(async () => {
  let db = new Database("testdatabase");
  await db.db.destroy();
});

test("Database basics", async () => {
  let database = new Database("testdatabase");
  let callback = jest.fn();
  await database.onMessage(callback);
  await database.create({ foo: "bar" });
  expect(callback.mock.calls.length).toBe(1);

  let database2 = new Database("testdatabase");
  let callback2 = jest.fn();
  await database2.onMessage(callback2);
  await database2.create({ baz: "qux" });
  expect(callback2.mock.calls.length).toBe(2);
});
