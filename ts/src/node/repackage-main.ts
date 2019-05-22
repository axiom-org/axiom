// This is a script to rewrite our own package.json.
// We do this because there are two different targets published to npm.
// axiom-cli is the command line interface, which needs a global script.
// axiom-api is the application interface, which only targets the browser.
//
// Something like Lerna could be the way to go, but it isn't obvious how to combine
// that with the fact that our code is broken into three directories by platform target,
// to make TypeScript happy.

import * as fs from "fs";
import * as path from "path";

const FILENAME = path.join(process.cwd(), "package.json");

// Alphabetizes an object at the base level
function alphabetize(obj) {
  let answer = {};
  let keys = [];
  for (let key in obj) {
    keys.push(key);
  }
  keys.sort();
  for (let key of keys) {
    answer[key] = obj[key];
  }
  return answer;
}

function fatal(message) {
  console.log(message);
  process.exit(1);
}

function getPackage() {
  let text = fs.readFileSync(FILENAME, "utf8");
  return JSON.parse(text);
}

function writePackage(data) {
  fs.writeFileSync(FILENAME, JSON.stringify(data, null, 2));
}

function main() {
  let args = process.argv.slice(2);
  if (args.length != 1) {
    fatal("Usage: npm run repackage [api or cli]");
  }
  let arg = args[0];
  let packageData = getPackage();

  if (arg === "api") {
    packageData.name = "axiom-api";
    packageData.description =
      "API for interacting with the Axiom.org cryptocurrency platform";
    packageData.bin = {};
    packageData.main = "build/browser/browser/AxiomAPI.js";
    writePackage(packageData);
    return;
  }

  if (arg === "cli") {
    packageData.name = "axiom-cli";
    packageData.description =
      "CLI for interacting with the Axiom.org cryptocurrency platform";
    packageData.bin = { axiom: "./build/node/node/cli-main.js" };
    packageData.main = null;
    writePackage(packageData);
    return;
  }

  fatal("unrecognized argument: " + arg);
}

main();
