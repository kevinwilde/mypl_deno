import { typeCheck } from "./typechecker.ts";

export type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

export function prettyPrint(obj: any) {
  return JSON.stringify(obj, null, 2);
}

export const genUniq = Symbol;
//// For debugging...easier to console log than symbols
// let i = 0;
// export const genUniq = () => {
//   i++;
//   return `?X_${i}` as any;
// };

export function printType(t: ReturnType<typeof typeCheck>) {
  // produces stream of identifiers like
  // 'a 'b 'c ... 'z 'aa 'ab 'ac ... 'az 'ba 'bb 'bc ... 'bz 'ca 'cb 'cc ...
  const nextFreeGenerator = () => {
    let i = 0;
    return () => {
      let n = i;
      let result = "'";
      while (n >= 26) {
        const multiple = Math.floor(n / 26);
        result += String.fromCharCode(97 + multiple - 1);
        n -= (26 * multiple);
      }
      result += String.fromCharCode(97 + (n % 26));
      i += 1;
      return result;
    };
  };
  const nextFree = nextFreeGenerator();

  const symbolToPrettyType: Map<symbol, string> = new Map();

  function helper(t: ReturnType<typeof typeCheck>): string {
    switch (t.tag) {
      case "TyBool":
        return "bool";
      case "TyInt":
        return "int";
      case "TyStr":
        return "str";
      case "TyList":
        return `(Listof ${helper(t.elementType.type)})`;
      case "TyRecord":
        return `{${
          Object.keys(t.fieldTypes).sort().map((k) =>
            `${k}:${helper(t.fieldTypes[k].type)}`
          ).join(" ")
        }}`;
      case "TyArrow":
        return `(-> (${(t.paramTypes.map((p) => helper(p.type))).join(" ")}) ${
          helper(t.returnType.type)
        })`;
      case "TyId": {
        if (!(symbolToPrettyType.has(t.name))) {
          symbolToPrettyType.set(t.name, nextFree());
        }
        return symbolToPrettyType.get(t.name)!;
      }
      default: {
        const _exhaustiveCheck: never = t;
        throw new Error();
      }
    }
  }

  return helper(t);
}
