import { TermWithInfo } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import { RuntimeError } from "./exceptions.ts";
import { DiscriminateUnion } from "./utils.ts";

export function evaluate(ast: TermWithInfo) {
  return interpretInEnv(ast, []);
}

type Environment = { name: string; value: Value }[];

export type Value =
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string }
  | { tag: "TmEmpty" }
  | { tag: "TmCons"; car: Value; cdr: Value }
  | { tag: "TmRecord"; fields: Record<string, Value> }
  | { tag: "TmClosure"; params: string[]; body: TermWithInfo; env: Environment }
  | {
    tag: "TmStdlibFun";
    impl: (...args: Value[]) => Value;
  };

function interpretInEnv(term: TermWithInfo, env: Environment): Value {
  switch (term.term.tag) {
    case "TmBool":
    case "TmInt":
    case "TmStr":
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
    case "TmEmpty": {
      return term.term;
    }
    case "TmCons":
      return {
        tag: "TmCons",
        car: interpretInEnv(term.term.car, env),
        cdr: interpretInEnv(term.term.cdr, env),
      };
    case "TmRecord": {
      const reducedFields: Record<string, Value> = {};
      for (const [fieldName, fieldTerm] of Object.entries(term.term.fields)) {
        reducedFields[fieldName] = interpretInEnv(fieldTerm, env);
      }
      return { tag: "TmRecord", fields: reducedFields };
    }
    case "TmProj": {
      const record = interpretInEnv(term.term.record, env);
      if (record.tag !== "TmRecord") {
        throw new Error("Error in typechecker");
      }
      return record.fields[term.term.fieldName];
    }
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
      let value;
      if (term.term.val.term.tag === "TmAbs") {
        // Special case to enable recursion
        const func = term.term.val.term;
        const closureEnvEntry: DiscriminateUnion<
          Value,
          "tag",
          "TmClosure"
        > = {
          tag: "TmClosure",
          params: func.params.map((p) => p.name),
          body: func.body,
          env: null as any,
        };
        // Add an entry to the Environment for this closure assigned to the name
        // of the let term we are evaluationg
        const closureEnv = [
          { name: term.term.name, value: closureEnvEntry },
          ...env,
        ];
        // Point the env for the closure back at the env we just created,
        // forming a circular reference to allow recursion
        closureEnvEntry.env = closureEnv;
        // Now interpret the val of the let term (the function we're creating)
        value = interpretInEnv(term.term.val, closureEnv);
      } else {
        value = interpretInEnv(term.term.val, env);
      }
      const newEnv = [{ name: term.term.name, value }, ...env];
      return interpretInEnv(term.term.body, newEnv);
    }
    case "TmApp": {
      const closure = interpretInEnv(term.term.func, env);
      const args = term.term.args.map((a) => interpretInEnv(a, env));
      if (closure.tag === "TmClosure") {
        // // Handled by typechecker
        // if (closure.params.length !== args.length) {
        //   throw new RuntimeError(
        //     `Incorrect number of arguments. Expected ${closure.params.length} but got ${args.length}`,
        //     term.term.args[term.term.args.length - 1].info,
        //   );
        // }
        const newEnv = closure.params.map((paramName, index) => ({
          name: paramName,
          value: args[index],
        })).concat(closure.env);
        return interpretInEnv(closure.body, newEnv);
      } else if (closure.tag === "TmStdlibFun") {
        // // Handled by typechecker
        // if (closure.type.paramTypes.length !== args.length) {
        //   throw new RuntimeError(
        //     `Incorrect number of arguments. Expected ${closure.type.paramTypes.length} but got ${args.length}`,
        //     term.term.args[term.term.args.length - 1].info,
        //   );
        // }
        // for (let i = 0; i < args.length; i++) {
        //   if (args[i].tag !== closure.type.paramTypes[i].tag) {
        //     throw new RuntimeError(
        //       `TypeError: Expected ${closure.type.paramTypes[i].tag} but got ${
        //         args[i].tag
        //       }`,
        //       term.term.args[i].info,
        //     );
        //   }
        // }
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
