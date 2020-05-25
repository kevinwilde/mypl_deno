import { Value } from "./interpreter.ts";

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

const STD_LIB: Record<string, DiscriminateUnion<Value, "tag", "STDLIB_FUN">> = {
  "+": {
    tag: "STDLIB_FUN",
    params: [{ tag: "INT" }, { tag: "INT" }],
    impl: (
      x: DiscriminateUnion<Value, "tag", "INT">,
      y: DiscriminateUnion<Value, "tag", "INT">,
    ) => ({ tag: "INT", val: x.val + y.val }),
  },
  "-": {
    tag: "STDLIB_FUN",
    params: [{ tag: "INT" }, { tag: "INT" }],
    impl: (
      x: DiscriminateUnion<Value, "tag", "INT">,
      y: DiscriminateUnion<Value, "tag", "INT">,
    ) => ({ tag: "INT", val: x.val - y.val }),
  },
  "*": {
    tag: "STDLIB_FUN",
    params: [{ tag: "INT" }, { tag: "INT" }],
    impl: (
      x: DiscriminateUnion<Value, "tag", "INT">,
      y: DiscriminateUnion<Value, "tag", "INT">,
    ) => ({ tag: "INT", val: x.val * y.val }),
  },
  "=": {
    tag: "STDLIB_FUN",
    params: [{ tag: "INT" }, { tag: "INT" }],
    impl: (
      x: DiscriminateUnion<Value, "tag", "INT">,
      y: DiscriminateUnion<Value, "tag", "INT">,
    ) => ({ tag: "BOOL", val: x.val === y.val }),
  },
  "string-concat": {
    tag: "STDLIB_FUN",
    params: [{ tag: "STR" }, { tag: "STR" }],
    impl: (
      x: DiscriminateUnion<Value, "tag", "STR">,
      y: DiscriminateUnion<Value, "tag", "STR">,
    ) => ({ tag: "STR", val: x.val + y.val }),
  },
};

export function lookupInStdLib(
  varName: string,
): (typeof STD_LIB[keyof typeof STD_LIB]) | undefined {
  return STD_LIB[varName] || undefined;
}
