import { Term as ParserTerm, Value as ParserValue } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";

export function evaluate(ast: ParserTerm) {
  return interpretInEnv(ast, []);
}

type Environment = { name: string; value: Value }[];
export type Value =
  | ParserValue
  | { tag: "CLOSURE"; params: string[]; body: Term; env: Environment }
  | {
    tag: "STDLIB_FUN";
    params: { tag: Value["tag"] }[];
    impl: (...args: any) => Value;
  };
type Term = ParserTerm | Value;

function interpretInEnv(term: Term, env: Environment): Value {
  switch (term.tag) {
    case "BOOL":
    case "INT":
    case "STR":
    case "CLOSURE":
    case "STDLIB_FUN":
      return term;
    case "ABS":
      return { tag: "CLOSURE", params: term.params, body: term.body, env };
    case "VAR":
      return lookupInEnv(term.name, env);
    case "IF": {
      const condResult = interpretInEnv(term.cond, env);
      if (condResult.tag !== "BOOL") {
        throw new Error("Expected condition to be a boolean expression");
      }
      return interpretInEnv(condResult.val ? term.then : term.else, env);
    }
    case "LET": {
      const newEnv = [{ name: term.name, value: interpretInEnv(term.val, env) }]
        .concat(env);
      return interpretInEnv(term.body, newEnv);
    }
    case "APP": {
      const closure = interpretInEnv(term.func, env);
      const args = term.args.map((a) => interpretInEnv(a, env));
      if (closure.tag === "CLOSURE") {
        if (closure.params.length !== args.length) {
          throw new Error(
            `Incorrect number of arguments. Expected ${closure.params.length} but got ${args.length}`,
          );
        }
        const newEnv = closure.params.map((paramName, index) => ({
          name: paramName,
          value: args[index],
        })).concat(closure.env);
        return interpretInEnv(closure.body, newEnv);
      } else if (closure.tag === "STDLIB_FUN") {
        if (closure.params.length !== args.length) {
          throw new Error(
            `Incorrect number of arguments. Expected ${closure.params.length} but got ${args.length}`,
          );
        }
        for (let i = 0; i < args.length; i++) {
          if (args[i].tag !== closure.params[i].tag) {
            throw new Error(
              `TypeError: Expected ${closure.params[i].tag} but got ${
                args[i].tag
              }`,
            );
          }
        }
        return closure.impl(...args);
      } else {
        throw new Error("cannot call a non function");
      }
    }
    default: {
      const _exhaustiveCheck: never = term;
      throw new Error();
    }
  }
}

function lookupInEnv(varName: string, env: Environment) {
  const envResult = env.filter((item) => item.name == varName)[0];
  if (envResult) return envResult.value;
  const stdlibValue = lookupInStdLib(varName);
  if (stdlibValue) return stdlibValue;
  throw new Error(`unbound variable: ${varName}`);
}
