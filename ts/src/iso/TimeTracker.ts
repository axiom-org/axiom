declare var process: any;

let tracking = process.hrtime && process.hrtime.bigint ? true : false;

export default class TimeTracker {
  static nanoseconds: { [name: string]: bigint } = {};
  static startTime: bigint;

  static start() {
    if (!tracking) {
      return;
    }

    TimeTracker.startTime = process.hrtime.bigint();
  }

  static end(name: string) {
    if (!tracking) {
      return;
    }
    if (!TimeTracker.startTime) {
      throw new Error("end without start");
    }

    let elapsed = process.hrtime.bigint() - TimeTracker.startTime;
    if (!TimeTracker.nanoseconds[name]) {
      TimeTracker.nanoseconds[name] = elapsed;
    } else {
      TimeTracker.nanoseconds[name] += elapsed;
    }
    TimeTracker.startTime = null;
  }

  static show() {
    let items = [];
    for (let name in TimeTracker.nanoseconds) {
      items.push([name, TimeTracker.nanoseconds[name]]);
    }
    items.sort(([n1, t1], [n2, t2]) => t2 - t1);
    for (let [name, total] of items) {
      console.log(`${Math.round(total / 1000000000)}s: ${name}`);
    }
  }
}
