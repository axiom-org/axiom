// Utilities for handling permission objects.
// These generally work on Permission messages, RequestPermission messages,
// or just plain objects.
//
// The format of a permission object is:
// publicKey: bool, whether the app may know the public key of the user

export function missingPermissions(granted, requested) {
  let answer = {} as any;
  if (requested.publicKey && !granted.publicKey) {
    answer.publicKey = true;
  }
  return answer;
}

export function hasPermission(granted, requested) {
  let missing = missingPermissions(granted, requested);
  for (let key in missing) {
    return false;
  }
  return true;
}
