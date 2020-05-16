import { Value } from "./interpreter.ts";

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

const STD_LIB: Record<string, DiscriminateUnion<Value, "type", "STDLIB_FUN">> =
  {
    "+": {
      type: "STDLIB_FUN",
      params: [{ type: "INT" }, { type: "INT" }],
      impl: (
        x: DiscriminateUnion<Value, "type", "INT">,
        y: DiscriminateUnion<Value, "type", "INT">,
      ) => ({ type: "INT", val: x.val + y.val }),
    },
    "-": {
      type: "STDLIB_FUN",
      params: [{ type: "INT" }, { type: "INT" }],
      impl: (
        x: DiscriminateUnion<Value, "type", "INT">,
        y: DiscriminateUnion<Value, "type", "INT">,
      ) => ({ type: "INT", val: x.val - y.val }),
    },
    "=": {
      type: "STDLIB_FUN",
      params: [{ type: "INT" }, { type: "INT" }],
      impl: (
        x: DiscriminateUnion<Value, "type", "INT">,
        y: DiscriminateUnion<Value, "type", "INT">,
      ) => ({ type: "BOOL", val: x.val === y.val }),
    },
  };

export function lookupInStdLib(
  varName: string,
): (typeof STD_LIB[keyof typeof STD_LIB]) | undefined {
  return STD_LIB[varName] || undefined;
}
