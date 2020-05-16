import { Term as ParserTerm, Value as ParserValue } from "./parser.ts";

export function evaluate(ast: ParserTerm) {
  return interpretInEnv(ast, []);
}

type Environment = { name: string; value: Value }[];
type Value =
  | ParserValue
  | { type: "CLOSURE"; params: string[]; body: Term; env: Environment };
type Term = ParserTerm | Value;

function interpretInEnv(term: Term, env: Environment): Value {
  switch (term.type) {
    case "BOOL":
    case "INT":
    case "STR":
    case "CLOSURE":
      return term;
    case "ABS":
      return { type: "CLOSURE", params: term.params, body: term.body, env };
    case "VAR":
      return lookupInEnv(term.name, env);
    case "BIOP": {
      const left = interpretInEnv(term.left, env);
      const right = interpretInEnv(term.right, env);
      switch (term.op) {
        case "+": {
          if (left.type !== "INT" || right.type !== "INT") {
            throw new Error("Tried to apply + to non-number");
          }
          return { type: "INT", val: left.val + right.val };
        }
        case "-": {
          if (left.type !== "INT" || right.type !== "INT") {
            throw new Error("Tried to apply + to non-number");
          }
          return { type: "INT", val: left.val - right.val };
        }
        case "=": {
          if (
            left.type === right.type && left.type !== "CLOSURE" &&
            right.type !== "CLOSURE"
          ) {
            return { type: "BOOL", val: left.val === right.val };
          }
          return { type: "BOOL", val: false };
        }
        default:
          const _exhaustiveCheck: never = term.op;
          throw new Error();
      }
    }
    case "LET": {
      const newEnv = [{ name: term.name, value: interpretInEnv(term.val, env) }]
        .concat(env);
      return interpretInEnv(term.body, newEnv);
    }
    case "IF": {
      const condResult = interpretInEnv(term.cond, env);
      if (condResult.type !== "BOOL") {
        throw new Error("Expected condition to be a boolean expression");
      }
      return interpretInEnv(condResult.val ? term.then : term.else, env);
    }
    case "APP": {
      const closure = interpretInEnv(term.func, env);
      const args = term.args.map((a) => interpretInEnv(a, env));
      if (closure.type !== "CLOSURE") {
        throw new Error("cannot call a non function");
      }
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
    }
    default: {
      const _exhaustiveCheck: never = term;
      throw new Error();
    }
  }
}

function lookupInEnv(varName: string, env: Environment) {
  const res = env.filter((item) => item.name == varName)[0];
  if (!res) throw new Error(`unbound variable: ${varName}`);
  return res.value;
}
