import Database from "./Database";

beforeEach(async () => {
  let db = new Database("testdatabase");
  await db.db.destroy();
});

test("Database basics", async () => {
  let database = new Database("testdatabase");
  let callback = jest.fn();
  database.onMessage(callback);
  await database.create({ foo: "bar" });
  expect(callback.mock.calls.length).toBe(1);
});
