import { useMockNetworking, useRealNetworking } from "./TestUtil";

beforeEach(() => {
  useMockNetworking();
});

afterEach(() => {
  useRealNetworking();
});

test("MockPeerServer network", async () => {
  let numSeeds = 4;
  let numNodes = 10;

  // TODO: real network stuff here
});
