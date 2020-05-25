import { Value } from "./interpreter.ts";

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

const STD_LIB: Record<string, DiscriminateUnion<Value, "tag", "TmStdlibFun">> =
  {
    "+": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmInt" }, { tag: "TmInt" }],
      impl: (
        x: DiscriminateUnion<Value, "tag", "TmInt">,
        y: DiscriminateUnion<Value, "tag", "TmInt">,
      ) => ({ tag: "TmInt", val: x.val + y.val }),
    },
    "-": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmInt" }, { tag: "TmInt" }],
      impl: (
        x: DiscriminateUnion<Value, "tag", "TmInt">,
        y: DiscriminateUnion<Value, "tag", "TmInt">,
      ) => ({ tag: "TmInt", val: x.val - y.val }),
    },
    "*": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmInt" }, { tag: "TmInt" }],
      impl: (
        x: DiscriminateUnion<Value, "tag", "TmInt">,
        y: DiscriminateUnion<Value, "tag", "TmInt">,
      ) => ({ tag: "TmInt", val: x.val * y.val }),
    },
    "=": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmInt" }, { tag: "TmInt" }],
      impl: (
        x: DiscriminateUnion<Value, "tag", "TmInt">,
        y: DiscriminateUnion<Value, "tag", "TmInt">,
      ) => ({ tag: "TmBool", val: x.val === y.val }),
    },
    "string-concat": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmStr" }, { tag: "TmStr" }],
      impl: (
        x: DiscriminateUnion<Value, "tag", "TmStr">,
        y: DiscriminateUnion<Value, "tag", "TmStr">,
      ) => ({ tag: "TmStr", val: x.val + y.val }),
    },
  };

export function lookupInStdLib(
  varName: string,
): (typeof STD_LIB[keyof typeof STD_LIB]) | undefined {
  return STD_LIB[varName] || undefined;
}
