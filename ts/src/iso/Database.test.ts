import Database from "./Database";

test("Database basics", async () => {
  let database = new Database("testchannel");
  let callback = jest.fn();
  database.onMessage(callback);
  database.create({ foo: "bar" });
  expect(callback.mock.calls.length).toBe(1);
});
