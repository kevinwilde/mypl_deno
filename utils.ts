import { typeCheck } from "./typechecker.ts";

export function prettyPrint(obj: any) {
  return JSON.stringify(obj, null, 2);
}

export function printType(t: ReturnType<typeof typeCheck>) {
  function helper(
    t: ReturnType<typeof typeCheck>,
  ): string {
    switch (t.tag) {
      case "TyBool":
        return "bool";
      case "TyInt":
        return "int";
      case "TyStr":
        return "str";
      case "TyRecord":
        return `{${
          Object.keys(t.fieldTypes).sort().map((k) =>
            `${k}:${printType(t.fieldTypes[k].type)}`
          ).join(" ")
        }}`;
      case "TyArrow":
        return `(-> (${(t.paramTypes.map((p) => helper(p.type))).join(" ")}) ${
          helper(t.returnType.type)
        })`;
      case "TyId":
        return `%${t.name}%`;
      default: {
        const _exhaustiveCheck: never = t;
        throw new Error();
      }
    }
  }

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

  const uglyResult = helper(t);
  const regex = new RegExp("(\%.+?\%)");
  const nextFree = nextFreeGenerator();
  let result = uglyResult;
  while (true) {
    const matches = regex.exec(result);
    if (matches === null) {
      break;
    }
    const match = matches[0];
    result = result.split(match).join(nextFree());
  }
  return result;
}
