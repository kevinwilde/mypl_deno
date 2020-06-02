import { Value } from "./interpreter.ts";
import { TypeWithInfo } from "./typechecker.ts";

type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

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

const STD_LIB: Record<string, StdLibFun> = {
  "+": {
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
  },
  "-": {
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
  },
  "*": {
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
  },
  "=": {
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
  },
  "string-concat": {
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
  },
  "fix": {
    // Only works for recursive functions that take 1 int and return an int
    // like factorial
    tag: "TmStdlibFun",
    type: {
      tag: "TyArrow",
      paramTypes: [
        createTypeWithInfo({
          "tag": "TyArrow",
          "paramTypes": [
            createTypeWithInfo({
              "tag": "TyArrow",
              "paramTypes": [createTypeWithInfo({ "tag": "TyId", name: "T0" })],
              "returnType": createTypeWithInfo({ "tag": "TyId", name: "T1" }),
            }),
          ],
          "returnType": createTypeWithInfo({
            "tag": "TyArrow",
            "paramTypes": [createTypeWithInfo({ "tag": "TyId", name: "T0" })],
            "returnType": createTypeWithInfo({ "tag": "TyId", name: "T1" }),
          }),
        }),
      ],
      returnType: createTypeWithInfo({
        tag: "TyArrow",
        paramTypes: [createTypeWithInfo({ tag: "TyId", name: "T0" })],
        returnType: createTypeWithInfo({ tag: "TyId", name: "T1" }),
      }),
    },
    impl: (f: DiscriminateUnion<Value, "tag", "TmClosure">) => {
      if (f.body.term.tag !== "TmAbs") {
        throw new Error();
      }
      const result: DiscriminateUnion<Value, "tag", "TmClosure"> = {
        tag: "TmClosure",
        params: [f.body.term.params[0].name],
        body: f.body.term.body,
        env: null as any,
      };
      const newEnv = [{ name: f.params[0], value: result }, ...f.env];
      result.env = newEnv;
      return result;
    },
  },
};

export function lookupInStdLib(
  varName: string,
): (typeof STD_LIB[keyof typeof STD_LIB]) | undefined {
  return STD_LIB[varName] || undefined;
}
