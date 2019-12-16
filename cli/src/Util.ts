import * as fs from "fs";
import * as path from "path";

export function getVersion(): string {
  let dir = __dirname;
  while (true) {
    try {
      let text = fs.readFileSync(path.join(dir, "package.json"), "utf8");
      let data = JSON.parse(text);
      return data.version;
    } catch (e) {}

    let newDir = path.join(dir, "..");
    if (dir === newDir) {
      throw new Error("could not find package.json");
    }
    dir = newDir;
  }
}
