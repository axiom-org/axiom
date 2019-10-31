import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import commander from "commander";

import Axiom, { KeyPair } from "axiom-api";
import PeerServer from "./PeerServer";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fatal(message: string) {
  console.log(message);
  process.exit(1);
}

function getVersion(): string {
  let dir = __dirname;
  while (true) {
    try {
      let text = fs.readFileSync(path.join(dir, "package.json"), "utf8");
      let data = JSON.parse(text);
      return data.version;
    } catch (e) {}

    let newDir = path.join(dir, "..");
    if (dir === newDir) {
      fatal("could not find package.json");
    }
    dir = newDir;
  }
}

async function scan(channel?: string, verbose?: boolean): Promise<never> {
  let axiom = new Axiom({ verbose });
  if (channel) {
    console.log("joining", channel);
    axiom.join(channel);
  }

  while (true) {
    await sleep(1000);
    console.log(axiom.statusLine());
    let names = axiom.getChannelMembers(channel).map(x => x.slice(0, 6));
    if (channel) {
      console.log(channel, "members:", names.join(","));
    }
  }
}

async function host(verbose?: boolean): Promise<never> {
  let axiom = new Axiom({ network: "prod", verbose });
  let server = new PeerServer(axiom.keyPair, 3500, verbose);

  console.log("hosting on port 3500");
  server.connectNode(axiom);
  while (true) {
    await sleep(60000);
    // TODO: output data of some sort every minute?
  }
}

export function main() {
  let program = new commander.Command();
  program
    .version(getVersion())
    .option("-v, --verbose", "output extra logs, useful for debugging");

  program
    .command("which")
    .description("output which file this CLI is running from")
    .action(() => {
      console.log(__filename);
    });

  program
    .command("scan [channel]")
    .description("scan the p2p network for activity")
    .action(async (channel?: string) => {
      await scan(channel, program.verbose);
    });

  program
    .command("host")
    .description("host data on the p2p network")
    .action(async () => {
      await host(program.verbose);
    });

  program.command("*").action(() => {
    program.outputHelp();
  });

  program.parse(process.argv);

  if (program.args.length == 0) {
    program.outputHelp();
  }
}
