export default interface IntervalTimer {
  clear(): void;
}

class RealIntervalTimer implements IntervalTimer {
  timer: any;

  constructor(callback: () => void, interval: number) {
    this.timer = setInterval(callback, interval);
  }

  clear() {
    clearInterval(this.timer);
  }
}

class MockIntervalTimer implements IntervalTimer {
  callback: () => void;

  static allTimers: MockIntervalTimer[] = [];

  static tick() {
    for (let timer of MockIntervalTimer.allTimers) {
      if (timer.callback) {
        timer.callback();
      }
    }
  }

  constructor(callback: () => void, interval: number) {
    this.callback = callback;
    MockIntervalTimer.allTimers.push(this);
  }

  clear() {
    this.callback = null;
  }
}

interface IntervalTimerConstructor {
  new (callback: () => void, interval: number): IntervalTimer;
}

let GLOBALS: { intervalTimerConstructor: IntervalTimerConstructor } = {
  intervalTimerConstructor: RealIntervalTimer
};

export function createIntervalTimer(callback: () => void, interval: number) {
  return new GLOBALS.intervalTimerConstructor(callback, interval);
}

export function useMockIntervalTimer() {
  GLOBALS.intervalTimerConstructor = MockIntervalTimer;
  MockIntervalTimer.allTimers = [];
}
