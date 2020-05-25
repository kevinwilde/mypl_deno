import { Value } from "./interpreter.ts";
import { Type } from "./typechecker.ts";

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

type StdLibFun = {
  tag: "TmStdlibFun";
  type: DiscriminateUnion<Type, "tag", "TyArrow">;
  // TODO
  // impl: (...args: Value[]) => Value;
  impl: (...args: any[]) => Value;
};

const STD_LIB: Record<string, StdLibFun> = {
  "+": {
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ tag: "TyInt" }, { tag: "TyInt" }],
      returnType: { tag: "TyInt" },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val + y.val }),
  },
  "-": {
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ tag: "TyInt" }, { tag: "TyInt" }],
      returnType: { tag: "TyInt" },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val - y.val }),
  },
  "*": {
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ tag: "TyInt" }, { tag: "TyInt" }],
      returnType: { tag: "TyInt" },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val * y.val }),
  },
  "=": {
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ tag: "TyInt" }, { tag: "TyInt" }],
      returnType: { tag: "TyBool" },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmBool", val: x.val === y.val }),
  },
  "string-concat": {
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ tag: "TyStr" }, { tag: "TyStr" }],
      returnType: { tag: "TyStr" },
    },
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
