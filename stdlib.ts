import { Value } from "./interpreter.ts";
import { DiscriminateUnion } from "./utils.ts";

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
    "empty?": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmList" }],
      impl: (
        lst: DiscriminateUnion<Value, "tag", "TmList">,
      ) => ({ tag: "TmBool", val: lst.elements.length === 0 }),
    },
    "car": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmList" }],
      impl: (
        lst: DiscriminateUnion<Value, "tag", "TmList">,
      ) => lst.elements[0],
    },
    "cdr": {
      tag: "TmStdlibFun",
      params: [{ tag: "TmList" }],
      impl: (
        lst: DiscriminateUnion<Value, "tag", "TmList">,
      ) => ({ tag: "TmList", elements: lst.elements.slice(1) }),
    },
  };

export function lookupInStdLib(
  varName: string,
): (typeof STD_LIB[keyof typeof STD_LIB]) | undefined {
  return STD_LIB[varName] || undefined;
}
