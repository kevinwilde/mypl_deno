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
  "=": (info) => {
    const paramType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [paramType, paramType],
        returnType: { info, type: { tag: "TyBool" } },
      },
      impl: (x: Value, y: Value) => {
        switch (x.tag) {
          case "TmBool":
          case "TmStr":
          case "TmInt": {
            if (x.tag !== y.tag) throw new Error();
            return { tag: "TmBool", val: x.val == y.val };
          }
          case "TmEmpty":
            return { tag: "TmBool", val: y.tag === "TmEmpty" };
          case "TmLocation":
          case "TmCons":
          case "TmClosure":
          case "TmRecord":
          case "TmStdlibFun":
            return { tag: "TmBool", val: x === y };
          default: {
            const _exhaustiveCheck: never = x;
            throw new Error();
          }
        }
      },
    };
  },
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
  "get-ref": (info) => {
    const valType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [{ info, type: { tag: "TyRef", valType } }],
        returnType: valType,
      },
      impl: (ref: DiscriminateUnion<Value, "tag", "TmLocation">) => ref.val,
    };
  },
  "set-ref": (info) => {
    const valType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    const refType: TypeWithInfo = {
      info,
      type: { tag: "TyRef", valType },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [refType, valType],
        returnType: refType, // TODO return void
      },
      impl: (
        ref: DiscriminateUnion<Value, "tag", "TmLocation">,
        val: Value,
      ) => {
        ref.val = val;
        return ref;
      },
    };
  },
  "begin": (info) => {
    const resultType: TypeWithInfo = {
      info,
      type: { tag: "TyId", name: genUniqTypeVar() },
    };
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [
          { info, type: { tag: "TyId", name: genUniqTypeVar() } }, // TODO only accept void
          resultType,
        ],
        returnType: resultType,
      },
      impl: (arg1: Value, arg2: Value) => arg2,
    };
  },
};

export function lookupInStdLib(
  varName: string,
  info: SourceInfo,
): (ReturnType<typeof STD_LIB[keyof typeof STD_LIB]>) | undefined {
  return STD_LIB[varName]?.(info) || undefined;
}
