import { Term } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import { TypeError } from "./exceptions.ts";

export type Type =
  | { tag: "TyBool" }
  | { tag: "TyInt" }
  | { tag: "TyStr" }
  | { tag: "TyArrow"; paramTypes: Type[]; returnType: Type };

type Context = { name: string; type: Type }[];

export function typeCheck(term: Term) {
  return getTypeOf(term, []);
}

function getTypeOf(term: Term, ctx: Context): Type {
  switch (term.term.tag) {
    case "TmBool":
      return { tag: "TyBool" };
    case "TmInt":
      return { tag: "TyInt" };
    case "TmStr":
      return { tag: "TyStr" };
    case "TmVar":
      return getTypeFromContext(ctx, term.term.name);
    case "TmIf": {
      const condType = getTypeOf(term.term.cond, ctx);
      if (condType.tag !== "TyBool") {
        throw new TypeError(
          `Expected guard of conditional to be a boolean but got ${condType.tag}`,
          term.term.cond.info,
        );
      }
      const thenType = getTypeOf(term.term.then, ctx);
      const elseType = getTypeOf(term.term.else, ctx);
      if (!typesAreEquiv(thenType, elseType)) {
        throw new TypeError(
          `Expected branches of conditional to be the same type but got ${thenType.tag} and ${elseType.tag}`,
          {
            startIdx: term.term.then.info.startIdx,
            endIdx: term.term.else.info.endIdx,
          },
        );
      }
      return thenType;
    }
    case "TmLet": {
      return getTypeOf(
        term.term.body,
        [{ name: term.term.name, type: getTypeOf(term.term.val, ctx) }].concat(
          ctx,
        ),
      );
    }
    case "TmAbs": {
      const newBindings = term.term.params.map((p) => ({
        name: p.name,
        type: p.typeAnn,
      }));
      return {
        tag: "TyArrow",
        paramTypes: newBindings.map((b) => b.type),
        returnType: getTypeOf(term.term.body, newBindings.concat(ctx)),
      };
    }
    case "TmApp": {
      const funcType = getTypeOf(term.term.func, ctx);
      if (funcType.tag !== "TyArrow") {
        throw new TypeError(
          `Expected arrow type but got ${funcType.tag}`,
          term.term.func.info,
        );
      }
      if (term.term.args.length !== funcType.paramTypes.length) {
        throw new TypeError(
          `arity mismatch: expected ${funcType.paramTypes.length} arguments, but got ${term.term.args.length}`,
          term.term.args[term.term.args.length - 1].info,
        );
      }
      const argTypes = term.term.args.map((arg) => getTypeOf(arg, ctx));
      for (let i = 0; i < argTypes.length; i++) {
        if (!typesAreEquiv(argTypes[i], funcType.paramTypes[i])) {
          throw new TypeError(
            `parameter type mismatch: expected type ${
              funcType.paramTypes[i].tag
            }, but got ${argTypes[i].tag}`,
            term.term.args[i].info,
          );
        }
      }
      return funcType.returnType;
    }
    default: {
      const _exhaustiveCheck: never = term.term;
      throw new Error();
    }
  }
}

// TODO going to need to handle name clashes
function getTypeFromContext(ctx: Context, varName: string): Type {
  const result = ctx.find((binding) => binding.name === varName);
  if (result) return result.type;
  const stdLibResult = lookupInStdLib(varName);
  if (stdLibResult) return stdLibResult.type;
  throw new Error(`Unbound variable: ${varName}`);
}

function typesAreEquiv(t1: Type, t2: Type) {
  if (t1.tag !== t2.tag) {
    return false;
  }
  if (
    t1.tag === "TyArrow" && t2.tag === "TyArrow" &&
    t1.paramTypes.length === t2.paramTypes.length
  ) {
    for (let i = 0; i < t1.paramTypes.length; i++) {
      if (!typesAreEquiv(t1.paramTypes[i], t2.paramTypes[i])) {
        return false;
      }
    }
    if (!typesAreEquiv(t1.returnType, t2.returnType)) {
      return false;
    }
  }
  return true;
}
