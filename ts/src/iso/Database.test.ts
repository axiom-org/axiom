import Database from "./Database";

test("Database basics", async () => {
  let database = new Database("testdatabase");
  let callback = jest.fn();
  database.onMessage(callback);
  await database.create({ foo: "bar" });
  expect(callback.mock.calls.length).toBe(1);
});
