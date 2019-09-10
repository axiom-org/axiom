import MemoryAdapter from "pouchdb-adapter-memory";
import PouchDB from "pouchdb";

import { useMockBasicPeer, useWebRTCBasicPeer } from "./BasicPeer";
import Database from "./Database";
import Peer from "./Peer";

PouchDB.plugin(MemoryAdapter);

export async function useTestEnvironment() {
  useMockBasicPeer();

  Database.adapter = "memory";

  let db = new Database("testdatabase");
  await db.db.destroy();
}

export async function useNormalEnvironment() {
  useWebRTCBasicPeer();
  Peer.intercept = {};

  Database.adapter = null;
}
