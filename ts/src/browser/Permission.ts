// Utilities for handling permission objects.
// These generally work on Permission messages, RequestPermission messages,
// or just plain objects.

// If you add more permissions try to keep them parallel to the blockchain operations
// they are enabling.
interface Permissions {
  // whether the app may know the public key of the user
  publicKey?: boolean;

  // a list of {name, size} tuples we are permitted to create
  createBucket?: { name: string; size: number }[];

  // a list of {name} we are permitted to update
  updateBucket?: { name: string }[];
}

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
function subtractLists(minuend, subtrahend) {
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

function addLists(list1, list2) {
  list1 = list1 || [];
  list2 = list2 || [];
  let answer = [];
  for (let item of list1) {
    answer.push(item);
  }
  for (let item of list2) {
    if (!shallowContains(list1, item)) {
      answer.push(item);
    }
  }
  return answer;
}

// Combines two permissions objects into one permissions object that has all the permissions
export function combinePermissions(
  perm1: Permissions,
  perm2: Permissions
): Permissions {
  let answer = {} as any;
  if (perm1.publicKey || perm2.publicKey) {
    answer.publicKey = true;
  }
  let createBucket = addLists(perm1.createBucket, perm2.createBucket);
  if (createBucket.length > 0) {
    answer.createBucket = createBucket;
  }
  let updateBucket = addLists(perm1.updateBucket, perm2.updateBucket);
  if (updateBucket.length > 0) {
    answer.updateBucket = updateBucket;
  }
  return answer;
}

// Which permissions are in granted but not in requested.
// Returns a permissions object
export function missingPermissions(
  granted: Permissions,
  requested: Permissions
): Permissions {
  let answer = {} as any;
  if (requested.publicKey && !granted.publicKey) {
    answer.publicKey = true;
  }
  let missingCreateBucket = subtractLists(
    requested.createBucket,
    granted.createBucket
  );
  if (missingCreateBucket.length > 0) {
    answer.createBucket = missingCreateBucket;
  }
  let missingUpdateBucket = subtractLists(
    requested.updateBucket,
    granted.updateBucket
  );
  if (missingUpdateBucket.length > 0) {
    answer.updateBucket = missingUpdateBucket;
  }
  return answer;
}

// Whether we have the provided permission
export function hasPermission(
  granted: Permissions,
  requested: Permissions
): boolean {
  let missing = missingPermissions(granted, requested);
  for (let key in missing) {
    return false;
  }
  return true;
}
