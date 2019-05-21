// Utilities for handling permission objects.
// These generally work on Permission messages, RequestPermission messages,
// or just plain objects.
//
// The format of a permission object is:
// publicKey: bool, whether the app may know the public key of the user
// createBucket: a list of {name, size} tuples we are permitted to create
// updateBucket: a list of {name} we are permitted to update
//
// If you add more permissions try to keep them parallel to the blockchain operations
// they are enabling.

function shallowEqual(a, b): boolean {
  for (let key in a) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  for (let key in b) {
    if (b[key] !== a[key]) {
      return false;
    }
  }
  return true;
}

function shallowContains(list, thing): boolean {
  for (let item of list) {
    if (shallowEqual(item, thing)) {
      return true;
    }
  }
  return false;
}

// minuend - subtrahend = difference
function subtractList(minuend, subtrahend) {
  minuend = minuend || [];
  subtrahend = subtrahend || [];
  let answer = [];
  for (let item of minuend) {
    if (!shallowContains(subtrahend, item)) {
      answer.push(item);
    }
  }
  return answer;
}

// Which permissions are in granted but not in requested.
// Returns a permissions object
export function missingPermissions(granted, requested) {
  let answer = {} as any;
  if (requested.publicKey && !granted.publicKey) {
    answer.publicKey = true;
  }
  let missingCreateBucket = subtractList(
    requested.createBucket,
    granted.createBucket
  );
  if (missingCreateBucket.length > 0) {
    answer.createBucket = missingCreateBucket;
  }
  let missingUpdateBucket = subtractList(
    requested.updateBucket,
    granted.updateBucket
  );
  if (missingUpdateBucket.length > 0) {
    answer.updateBucket = missingUpdateBucket;
  }
  return answer;
}

// Whether we have the provided permission
export function hasPermission(granted, requested) {
  let missing = missingPermissions(granted, requested);
  for (let key in missing) {
    return false;
  }
  return true;
}
