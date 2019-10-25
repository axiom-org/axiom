declare var process: any;
declare var BigInt: any;

let tracking = process.hrtime && process.hrtime.bigint ? true : false;

export default class TimeTracker {
  static nanoseconds: { [name: string]: bigint } = {};
  static calls: { [name: string]: number } = {};
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
      TimeTracker.calls[name] = 1;
    } else {
      TimeTracker.nanoseconds[name] += elapsed;
      TimeTracker.calls[name] += 1;
    }
    TimeTracker.startTime = null;
  }

  static show() {
    let items = [];
    for (let name in TimeTracker.nanoseconds) {
      items.push([
        name,
        TimeTracker.nanoseconds[name],
        TimeTracker.calls[name]
      ]);
    }
    items.sort(([n1, t1, c1], [n2, t2, c2]) => t2 - t1);
    for (let [name, total, calls] of items) {
      console.log(
        `${total / BigInt(1000000000)}s over ${calls} calls: ${name}`
      );
    }
  }
}
