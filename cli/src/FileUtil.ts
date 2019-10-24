// Utility functions that involve the filesystem

import * as fs from "fs";

import { KeyPair } from "axiom-api";

export function isDirectory(dir) {
  return fs.existsSync(dir) && fs.lstatSync(dir).isDirectory();
}

export function isFile(filename) {
  return fs.existsSync(filename) && fs.lstatSync(filename).isFile();
}

export function loadKeyPair(filename) {
  if (!fs.existsSync(filename)) {
    throw new Error(filename + " does not exist");
  }
  let stat = fs.lstatSync(filename);
  if (!stat.isFile() && !stat.isSymbolicLink()) {
    console.log(filename, "lstat:", stat);
    throw new Error("cannot read " + filename);
  }
  let serialized = fs.readFileSync(filename, "utf8");
  return KeyPair.fromSerialized(serialized);
}
