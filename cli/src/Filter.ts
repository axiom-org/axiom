import * as fs from "fs";

import { AxiomObject, Database } from "axiom-api";

// A Filter is a list of rules.
// It specifies a way to decide on keeping some AxiomObjects and discarding some.
// A line of the filter looks like:
// <channel>.<database>.<key=value>
// The keys supported at the moment:
//   owner
//   id
//   maxAge (measured in days)
// Only channel and database are mandatory.
// It can be prefixed with a ! to blacklist instead of whitelist.
// Later rules take precedence over previous rules.
export class Rule {
  accept: boolean;
  channel: string;
  database: string;
  key: "id" | "owner" | "maxAge" | undefined;
  value?: string;

  constructor(line: string) {
    let parts = line.trim().split(".");
    if (parts.length <= 1) {
      throw new Error(`not enough parts in line: ${line.trim()}`);
    }
    let [channel, database, ...rest] = parts;
    let regex = RegExp("^[0-9A-Za-z]+$");
    if (!regex.test(database)) {
      throw new Error(`bad database: ${database}`);
    }
    this.accept = !channel.startsWith("!");
    if (!this.accept) {
      channel = channel.slice(1);
    }
    if (!regex.test(channel)) {
      throw new Error(`bad channel: ${channel}`);
    }
    this.channel = channel;
    this.database = database;
    if (rest.length == 0) {
      return;
    }
    let lastPart = rest.join(".");
    parts = lastPart.split("=");
    if (parts.length < 2) {
      throw new Error(`expected key=value but got ${lastPart}`);
    }
    let [key, ...valueParts] = parts;
    if (key == "id" || key == "owner" || key == "maxAge") {
      this.key = key;
    } else {
      throw new Error(`unexpected key: ${key}`);
    }
    this.value = valueParts.join("=");
  }

  // Whether this rule matches this object.
  // You still have to check `accept` to see if it's a positive or negative match.
  match(obj: AxiomObject): boolean {
    if (
      obj.database.name != this.database ||
      obj.database.channel.name != this.channel
    ) {
      return false;
    }

    switch (this.key) {
      case undefined:
        return true;
      case "id":
        return obj.id == this.value;
      case "owner":
        return obj.owner == this.value;
      case "maxAge":
        // Calculate the object's age
        let ms = new Date().getTime() - obj.timestamp.getTime();
        let seconds = ms / 1000;
        let minutes = seconds / 60;
        let hours = minutes / 60;
        let days = hours / 24;
        return days < parseFloat(this.value);
    }
  }
}

function pluralize(num: number, phrase: string) {
  return `${num} ${phrase}${num == 1 ? "" : "s"}`;
}

export default class Filter {
  // Currently filters can only handle one channel, but this could be extended
  channel?: string;

  // ruleMap is keyed by database
  ruleMap: { [database: string]: Rule[] };

  numDatabases: number;
  numRules: number;
  verbose: boolean;

  constructor(verbose?: boolean) {
    this.verbose = !!verbose;
    this.ruleMap = {};
    this.numDatabases = 0;
    this.numRules = 0;
  }

  addRule(rule: Rule) {
    if (!this.channel) {
      this.channel = rule.channel;
    } else if (this.channel !== rule.channel) {
      throw new Error("Filters currently do not support multiple channels");
    }
    if (!this.ruleMap[rule.database]) {
      this.numDatabases++;
      this.ruleMap[rule.database] = [];
    }
    this.ruleMap[rule.database].push(rule);
    this.numRules++;
  }

  loadFile(filename: string) {
    let data = fs.readFileSync(filename, "utf8");
    let lines = data.split("\n");
    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (line.startsWith("#")) {
        // Skip comments
        continue;
      }
      if (line.length == 0) {
        // Skip blank lines
        continue;
      }
      let rule = new Rule(line);
      this.addRule(rule);
    }
    if (this.verbose) {
      let frs = pluralize(this.numRules, "filter rule");
      let dbs = pluralize(this.numDatabases, "database");
      console.log(`loaded ${frs} across ${dbs}`);
    }
  }

  // Evalutes the most recently added rule matching this object.
  // If there is no matching rule, return false.
  accept(database: Database, obj: AxiomObject): boolean {
    if (this.channel != database.channel.name) {
      return false;
    }
    let rules = this.ruleMap[database.name];
    if (!rules) {
      return false;
    }
    for (let i = rules.length - 1; i >= 0; i--) {
      let rule = rules[i];
      if (rule.match(obj)) {
        return rule.accept;
      }
    }
    return false;
  }

  async activate(database: Database): Promise<void> {
    database.useFilter((obj: AxiomObject) => {
      return this.accept(database, obj);
    });
  }
}
