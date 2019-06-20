// Utility functions

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isEmpty(obj: object): boolean {
  for (let key in obj) {
    return false;
  }
  return true;
}

// Makes a validated bucket name from a user-provided one.
// Throws an error if the input is invalid.
export function makeBucketName(input): string {
  let parts = input.split(":");
  if (parts.length > 2) {
    throw new Error("bucket name has too many parts: " + input);
  }
  if (parts.length == 0) {
    throw new Error('bucket name ("' + input + '") is empty');
  }
  if (parts.length == 1) {
    parts.unshift("www");
  }

  // Validate the parts. Make sure this regex matches the one in bucket.go
  let regex = RegExp("^[-a-zA-Z0-9]+$");
  for (let i = 0; i < 2; i++) {
    if (i == 0 && parts[0] == "www") {
      continue;
    }
    if (!regex.test(parts[i])) {
      throw new Error("bucket name has an invalid part: " + parts[i]);
    }
  }

  return parts.join(":");
}
