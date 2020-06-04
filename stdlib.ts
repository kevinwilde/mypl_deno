import { Value } from "./interpreter.ts";
import { TypeWithInfo } from "./typechecker.ts";
import { DiscriminateUnion, genUniq } from "./utils.ts";

type StdLibFun = {
  tag: "TmStdlibFun";
  type: DiscriminateUnion<TypeWithInfo["type"], "tag", "TyArrow">;
  // TODO
  // impl: (...args: Value[]) => Value;
  impl: (...args: any[]) => Value;
};

// TODO this sucks
const createTypeWithInfo = (t: TypeWithInfo["type"]): TypeWithInfo => {
  return { info: { startIdx: -1, endIdx: -1 }, type: t };
};

const STD_LIB: Record<string, () => StdLibFun> = {
  "+": () => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo({ tag: "TyInt" }),
        createTypeWithInfo({ tag: "TyInt" }),
      ],
      returnType: createTypeWithInfo({ tag: "TyInt" }),
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val + y.val }),
  }),
  "-": () => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo({ tag: "TyInt" }),
        createTypeWithInfo({ tag: "TyInt" }),
      ],
      returnType: createTypeWithInfo({ tag: "TyInt" }),
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val - y.val }),
  }),
  "*": () => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo({ tag: "TyInt" }),
        createTypeWithInfo({ tag: "TyInt" }),
      ],
      returnType: createTypeWithInfo({ tag: "TyInt" }),
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmInt", val: x.val * y.val }),
  }),
  "=": () => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo({ tag: "TyInt" }),
        createTypeWithInfo({ tag: "TyInt" }),
      ],
      returnType: createTypeWithInfo({ tag: "TyBool" }),
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmInt">,
      y: DiscriminateUnion<Value, "tag", "TmInt">,
    ) => ({ tag: "TmBool", val: x.val === y.val }),
  }),
  "string-concat": () => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo({ tag: "TyStr" }),
        createTypeWithInfo({ tag: "TyStr" }),
      ],
      returnType: createTypeWithInfo({ tag: "TyStr" }),
    },
    impl: (
      x: DiscriminateUnion<Value, "tag", "TmStr">,
      y: DiscriminateUnion<Value, "tag", "TmStr">,
    ) => ({ tag: "TmStr", val: x.val + y.val }),
  }),
  "cons": () => {
    const elementType = createTypeWithInfo({ tag: "TyId", name: genUniq() });
    const listType = createTypeWithInfo({ tag: "TyList", elementType });
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
  "empty?": () => ({
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo(
          {
            tag: "TyList",
            elementType: createTypeWithInfo({ tag: "TyId", name: genUniq() }),
          },
        ),
      ],
      returnType: createTypeWithInfo({ tag: "TyBool" }),
    },
    impl: (
      lst:
        | DiscriminateUnion<Value, "tag", "TmCons">
        | DiscriminateUnion<Value, "tag", "TmEmpty">,
    ) => ({ tag: "TmBool", val: lst.tag === "TmEmpty" }),
  }),
  "car": () => {
    const elementType = createTypeWithInfo({ tag: "TyId", name: genUniq() });
    return {
      tag: "TmStdlibFun",
      type: {
        tag: "TyArrow",
        paramTypes: [createTypeWithInfo({ tag: "TyList", elementType })],
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
  "cdr": () => {
    const elementType = createTypeWithInfo({ tag: "TyId", name: genUniq() });
    const listType = createTypeWithInfo({ tag: "TyList", elementType });
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
): (ReturnType<typeof STD_LIB[keyof typeof STD_LIB]>) | undefined {
  return STD_LIB[varName]?.() || undefined;
}
