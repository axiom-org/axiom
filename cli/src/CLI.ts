import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import commander from "commander";

import Axiom, { KeyPair } from "axiom-api";
import Filter from "./Filter";
import PeerServer from "./PeerServer";
import { getVersion } from "./Util";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function host(
  filterFile?: string,
  hostingDir?: string,
  verbose?: boolean
): Promise<never> {
  let axiom = new Axiom({ network: "prod", verbose });
  let server = new PeerServer(axiom.keyPair, 3500, verbose);
  let dir = hostingDir || ".";

  console.log("hosting on port 3500");
  server.connectNode(axiom);

  if (filterFile) {
    console.log("loading", filterFile);
    let filter = new Filter(true);
    filter.loadFile(filterFile);
    if (!filter.channel) {
      throw new Error(`found no channel in ${filterFile}`);
    }
    let prefix = path.resolve(dir, filter.channel + "_");
    let channel = axiom.channel(filter.channel, prefix);
    for (let dbname in filter.ruleMap) {
      console.log(`hosting ${channel.name}.${dbname}`);
      let database = channel.database(dbname);
      filter.activate(database);
    }
  }

  while (true) {
    await sleep(1000 * 60 * 10);
    console.log(axiom.statusLine());
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
    .option("-f, --filter <file>", "the filter file to use for hosting")
    .option(
      "-s, --storage <dir>",
      "the directory to put hosting databases in. defaults to the current directory"
    )
    .action(async (options: any) => {
      await host(options.filter, options.storage, program.verbose);
    });

  program.command("*").action(() => {
    program.outputHelp();
  });

  program.parse(process.argv);

  if (program.args.length == 0) {
    program.outputHelp();
  }
}
