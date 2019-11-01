import * as path from "path";

import Filter, { Rule } from "./Filter";

declare global {
  namespace jest {
    interface Matchers<R> {
      toRule(): R;
    }
  }
}

expect.extend({
  toRule(line: string) {
    try {
      new Rule(line);
    } catch (e) {
      return {
        message: () => `expected ${line} to be a valid rule, but it threw ${e}`,
        pass: false
      };
    }
    return {
      message: () => `expected ${line} to be an invalid rule`,
      pass: true
    };
  }
});

test("Rule creation", () => {
  expect("").not.toRule();
  expect("zork-bop.yo").not.toRule();
  expect("App").not.toRule();
  expect("Foo.Bar").toRule();
  expect("Foo.Bar!").not.toRule();
  expect("Foo.Bar.baz").not.toRule();
  expect("foo.bar.id=qux").toRule();
  expect("  foo.bar.id=qux \n").toRule();
  expect("foo.bar.id=qux.zip").toRule();
  expect("!foo.bar.id=qux.zip").toRule();
  expect("foo.bar.owner=qux").toRule();
  expect("foo.bar.sup=qux").not.toRule();
});

test("Filter loading", () => {
  let filename = path.join(__dirname, "../../ops/axboard.txt");
  let filter = new Filter();
  filter.loadFile(filename);
});
