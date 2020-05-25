import { Term as ParserTerm, Value as ParserValue } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import { SourceInfo } from "./lexer.ts";
import { RuntimeError } from "./exceptions.ts";

export function evaluate(ast: ParserTerm) {
  return interpretInEnv(ast, []);
}

type Environment = { name: string; value: Value }[];
export type Value =
  | ParserValue
  | { tag: "TmClosure"; params: string[]; body: Term; env: Environment }
  | {
    tag: "TmStdlibFun";
    params: { tag: Value["tag"] }[];
    impl: (...args: any) => Value;
  };
type Term = {
  info: SourceInfo;
  term: (Value | ParserTerm["term"]);
};

function interpretInEnv(term: Term, env: Environment): Value {
  switch (term.term.tag) {
    case "TmBool":
    case "TmInt":
    case "TmStr":
    case "TmClosure":
    case "TmStdlibFun":
      return term.term;
    case "TmAbs":
      return {
        tag: "TmClosure",
        params: term.term.params.map((p) => p.name),
        body: term.term.body,
        env,
      };
    case "TmVar":
      return lookupInEnv(term.term.name, env);
    case "TmIf": {
      const condResult = interpretInEnv(term.term.cond, env);
      if (condResult.tag !== "TmBool") {
        // Should never happen as it's already be handled by typechecker
        throw new RuntimeError(
          `Expected condition to be a boolean expression but got ${condResult.tag}`,
          term.term.cond.info,
        );
      }
      return interpretInEnv(
        condResult.val ? term.term.then : term.term.else,
        env,
      );
    }
    case "TmLet": {
      const newEnv = [
        { name: term.term.name, value: interpretInEnv(term.term.val, env) },
      ].concat(env);
      return interpretInEnv(term.term.body, newEnv);
    }
    case "TmApp": {
      const closure = interpretInEnv(term.term.func, env);
      const args = term.term.args.map((a) => interpretInEnv(a, env));
      if (closure.tag === "TmClosure") {
        if (closure.params.length !== args.length) {
          throw new RuntimeError(
            `Incorrect number of arguments. Expected ${closure.params.length} but got ${args.length}`,
            term.term.args[term.term.args.length - 1].info,
          );
        }
        const newEnv = closure.params.map((paramName, index) => ({
          name: paramName,
          value: args[index],
        })).concat(closure.env);
        return interpretInEnv(closure.body, newEnv);
      } else if (closure.tag === "TmStdlibFun") {
        if (closure.params.length !== args.length) {
          throw new RuntimeError(
            `Incorrect number of arguments. Expected ${closure.params.length} but got ${args.length}`,
            term.term.args[term.term.args.length - 1].info,
          );
        }
        for (let i = 0; i < args.length; i++) {
          if (args[i].tag !== closure.params[i].tag) {
            throw new RuntimeError(
              `TypeError: Expected ${closure.params[i].tag} but got ${
                args[i].tag
              }`,
              term.term.args[i].info,
            );
          }
        }
        return closure.impl(...args);
      } else {
        throw new Error("cannot call a non function");
      }
    }
    default: {
      const _exhaustiveCheck: never = term.term;
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
