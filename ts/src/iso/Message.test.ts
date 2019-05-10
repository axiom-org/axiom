import Message from "./Message";

test("Message serialization", () => {
  let m = new Message("Test", { foo: "bar" });
  expect((m as any).foo).toEqual("bar");
  let m2 = Message.fromSerialized(m.serialize());
  expect(m2.foo).toEqual("bar");
});
