import Node from "./Node";

test("Node basics", () => {
  let client = new Node(true);
  let server = new Node(true);

  client.connect("XXX");
  server.listen(3434);
});
