// A Filter is a list of rules.
// It specifies a way to decide on keeping some AxiomObjects and discarding some.
// A line of the filter looks like:
// <channel>.<database>.<key=value>
// The only keys supported at the moment are id and owner.
// Only channel and database are mandatory.
// It can be prefixed with a ! to blacklist instead of whitelist.
// Later rules take precedence over previous rules.
export class Rule {
  accept: boolean;
  channel: string;
  database: string;
  key: "id" | "owner" | undefined;
  value?: string;

  constructor(line: string) {
    let parts = line.trim().split(".");
    if (parts.length < 0) {
      throw new Error(`not enough parts in line: ${line.trim()}`);
    }
    let [channel, database, ...rest] = parts;
    this.accept = !channel.startsWith("!");
    if (!this.accept) {
      channel = channel.slice(0);
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
    if (key == "id" || key == "owner") {
      this.key = key;
    } else {
      throw new Error(`unexpected key: ${key}`);
    }
    this.value = valueParts.join("=");
  }
}

export default class Filter {
  // ruleMap is keyed by channel.database
  ruleMap: { [ruleID: string]: Rule[] };

  constructor() {
    this.ruleMap = {};
  }

  loadFile(filename: string) {
    // TODO
  }
}
