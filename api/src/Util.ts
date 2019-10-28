// Utility functions

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isEmpty(obj: object): boolean {
  for (let key in obj) {
    return false;
  }
  return true;
}
