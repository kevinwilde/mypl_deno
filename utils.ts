export function assert(cond: boolean, msg = ""): asserts cond is true {
  if (!cond) {
    throw new Error(`AssertionFailed: ${msg}`);
  }
}

export function prettyPrint(obj: any) {
  return JSON.stringify(obj, null, 2);
}
