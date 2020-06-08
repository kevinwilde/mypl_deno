import { typeCheck } from "./typechecker.ts";

export type DiscriminateUnion<T, K extends keyof T, V extends T[K]> = T extends
  Record<K, V> ? T : never;

export function prettyPrint(obj: any) {
  function removeInfo(arg: any): any {
    if (!arg) {
      return arg;
    }
    if (Array.isArray(arg)) {
      return arg.map((el) => removeInfo(el));
    }
    if ("info" in arg) {
      const { info, ...result } = arg;
      if (Object.keys(result).length === 1) {
        return removeInfo(result[Object.keys(result)[0]]);
      }
      return removeInfo(result);
    }
    const result: any = {};
    for (const [k, v] of Object.entries(arg)) {
      if (typeof v === "object") {
        result[k] = removeInfo(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }
  return JSON.stringify(removeInfo(obj), null, 2);
}

export function omit<T>(obj: Record<string, T>, keys: string[]) {
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) {
      result[k] = v;
    }
  }
  return result;
}

export const genUniqTypeVar = Symbol;
export const genUniqRowVar = Symbol;
//// For debugging...easier to console log than symbols
// let i = 0;
// export const genUniqTypeVar = () => {
//   i++;
//   return `?X_${i}` as any;
// };
// export const genUniqRowVar = () => {
//   i++;
//   return `?p_${i}` as any;
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
          Object.keys(t.rowExp.fieldTypes).sort().map((k) =>
            `${k}:${helper(t.rowExp.fieldTypes[k].type)}`
          ).join(" ")
        }}`;
      case "TyArrow":
        return `(-> (${(t.paramTypes.map((p) => helper(p.type))).join(" ")}) ${
          helper(t.returnType.type)
        })`;
      case "TyRef":
        return `(ref ${helper(t.valType.type)})`;
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
