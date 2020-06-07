import { Value } from "./interpreter.ts";
import { TypeWithInfo } from "./typechecker.ts";
import { DiscriminateUnion, genUniqTypeVar } from "./utils.ts";
import { SourceInfo } from "./lexer.ts";

type StdLibFun = {
  tag: "TmStdlibFun";
  type: DiscriminateUnion<TypeWithInfo["type"], "tag", "TyArrow">;
  // TODO
  // impl: (...args: Value[]) => Value;
  impl: (...args: any[]) => Value;
};

const STD_LIB: Record<string, (info: SourceInfo) => StdLibFun> = {
  "not": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ info, type: { tag: "TyBool" } }],
      returnType: { info, type: { tag: "TyBool" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmBool">,
    ) => ({ tag: "TmBool", val: !(x.val) }),
  }),
  "and": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyBool" } },
        { info, type: { tag: "TyBool" } },
      ],
      returnType: { info, type: { tag: "TyBool" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmBool">,
      y: DiscriminateUnion<Value, "tag", "TmBool">,
    ) => ({ tag: "TmBool", val: x.val && y.val }),
  }),
  "or": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyBool" } },
        { info, type: { tag: "TyBool" } },
      ],
      returnType: { info, type: { tag: "TyBool" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmBool">,
      y: DiscriminateUnion<Value, "tag", "TmBool">,
    ) => ({ tag: "TmBool", val: x.val || y.val }),
  }),
  "+": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyInt" } },
        { info, type: { tag: "TyInt" } },
      ],
      returnType: { info, type: { tag: "TyInt" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val + y.val }),
  }),
  "-": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyInt" } },
        { info, type: { tag: "TyInt" } },
      ],
      returnType: { info, type: { tag: "TyInt" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val - y.val }),
  }),
  "*": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyInt" } },
        { info, type: { tag: "TyInt" } },
      ],
      returnType: { info, type: { tag: "TyInt" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val * y.val }),
  }),
  "=": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyInt" } },
        { info, type: { tag: "TyInt" } },
      ],
      returnType: { info, type: { tag: "TyBool" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmBool", val: x.val === y.val }),
  }),
  "string-length": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ info, type: { tag: "TyStr" } }],
      returnType: { info, type: { tag: "TyInt" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmStr">,
    ) => ({ tag: "TmInt", val: x.val.length }),
  }),
  "string->list": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [{ info, type: { tag: "TyStr" } }],
      returnType: {
        info,
        type: { tag: "TyList", elementType: { info, type: { tag: "TyStr" } } },
      },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmStr">,
    ) => {
      let curTerm: Value = { tag: "TmEmpty" };
      let i = x.val.length - 1;
      while (i >= 0) {
        curTerm = {
          tag: "TmCons",
          car: { tag: "TmStr", val: x.val[i] },
          cdr: curTerm,
        };
        i--;
      }
      return curTerm;
    },
  }),
  "string-concat": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        { info, type: { tag: "TyStr" } },
        { info, type: { tag: "TyStr" } },
      ],
      returnType: { info, type: { tag: "TyStr" } },
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmStr">,
      y: DiscriminateUnion<Value, "tag", "TmStr">,
    ) => ({ tag: "TmStr", val: x.val + y.val }),
  }),
  "cons": (info) => {
    const elementType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    const listType: TypeWithInfo = {
      info,
      type: { tag: "TyList", elementType },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [elementType, listType],
        returnType: listType,
      },
      impl: (car: Value, cdr: Value) => ({ tag: "TmCons", car, cdr }),
    };
  },
  "empty?": (info) => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        ({
          info,
          type: {
            tag: "TyList",
            elementType:
              ({ info, type: { tag: "TyId", name: genUniqTypeVar() } }),
          },
        }),
      ],
      returnType: ({ info, type: { tag: "TyBool" } }),
    },
    impl: (
      lst:
        | DiscriminateUnion<Value, "tag", "TmCons">
        | DiscriminateUnion<Value, "tag", "TmEmpty">,
    ) => ({ tag: "TmBool", val: lst.tag === "TmEmpty" }),
  }),
  "car": (info) => {
    const elementType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [{ info, type: { tag: "TyList", elementType } }],
        returnType: elementType,
      },
      impl: (
        lst:
          | DiscriminateUnion<Value, "tag", "TmCons">
          | DiscriminateUnion<Value, "tag", "TmEmpty">,
      ) => {
        if (lst.tag === "TmEmpty") throw new Error("Called car on empty list");
        return lst.car;
      },
    };
  },
  "cdr": (info) => {
    const elementType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    const listType: TypeWithInfo = {
      info,
      type: { tag: "TyList", elementType },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [listType],
        returnType: listType,
      },
      impl: (
        lst:
          | DiscriminateUnion<Value, "tag", "TmCons">
          | DiscriminateUnion<Value, "tag", "TmEmpty">,
      ) => {
        if (lst.tag === "TmEmpty") throw new Error("Called cdr on empty list");
        return lst.cdr;
      },
    };
  },
};

export function lookupInStdLib(
  varName: string,
  info: SourceInfo,
): (ReturnType<typeof STD_LIB[keyof typeof STD_LIB]>) | undefined {
  return STD_LIB[varName]?.(info) || undefined;
}
