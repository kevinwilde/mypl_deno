import { Term } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import { TypeError } from "./exceptions.ts";
import { SourceInfo } from "./lexer.ts";

export type Type =
  | { tag: "TyBool" }
  | { tag: "TyInt" }
  | { tag: "TyStr" }
  | { tag: "TyArrow"; paramTypes: Type[]; returnType: Type }
  | { tag: "TyId"; name: string };

type Context = { name: string; type: Type }[];

export function typeCheck(term: Term) {
  // return getTypeOf(term, []);
  const [type, _, constraints] = recon([], uniqVarGen, term);
  const resultConstraints = unify(term.info, [], "hi kevin", constraints);
  const finalType = applySubst(resultConstraints, type);
  return finalType;
}

// function getTypeOf(term: Term, ctx: Context): Type {
//   switch (term.term.tag) {
//     case "TmBool":
//       return { tag: "TyBool" };
//     case "TmInt":
//       return { tag: "TyInt" };
//     case "TmStr":
//       return { tag: "TyStr" };
//     case "TmVar":
//       return getTypeFromContext(ctx, term.term.name);
//     case "TmIf": {
//       const condType = getTypeOf(term.term.cond, ctx);
//       if (condType.tag !== "TyBool") {
//         throw new TypeError(
//           `Expected guard of conditional to be a boolean but got ${condType.tag}`,
//           term.term.cond.info,
//         );
//       }
//       const thenType = getTypeOf(term.term.then, ctx);
//       const elseType = getTypeOf(term.term.else, ctx);
//       if (!typesAreEquiv(thenType, elseType)) {
//         throw new TypeError(
//           `Expected branches of conditional to be the same type but got ${thenType.tag} and ${elseType.tag}`,
//           {
//             startIdx: term.term.then.info.startIdx,
//             endIdx: term.term.else.info.endIdx,
//           },
//         );
//       }
//       return thenType;
//     }
//     case "TmLet": {
//       return getTypeOf(
//         term.term.body,
//         [{ name: term.term.name, type: getTypeOf(term.term.val, ctx) }].concat(
//           ctx,
//         ),
//       );
//     }
//     case "TmAbs": {
//       const newBindings = term.term.params.map((p) => ({
//         name: p.name,
//         type: p.typeAnn,
//       }));
//       return {
//         tag: "TyArrow",
//         paramTypes: newBindings.map((b) => b.type),
//         returnType: getTypeOf(term.term.body, newBindings.concat(ctx)),
//       };
//     }
//     case "TmApp": {
//       const funcType = getTypeOf(term.term.func, ctx);
//       if (funcType.tag !== "TyArrow") {
//         throw new TypeError(
//           `Expected arrow type but got ${funcType.tag}`,
//           term.term.func.info,
//         );
//       }
//       if (term.term.args.length !== funcType.paramTypes.length) {
//         throw new TypeError(
//           `arity mismatch: expected ${funcType.paramTypes.length} arguments, but got ${term.term.args.length}`,
//           term.term.args[term.term.args.length - 1].info,
//         );
//       }
//       const argTypes = term.term.args.map((arg) => getTypeOf(arg, ctx));
//       for (let i = 0; i < argTypes.length; i++) {
//         if (!typesAreEquiv(argTypes[i], funcType.paramTypes[i])) {
//           throw new TypeError(
//             `parameter type mismatch: expected type ${
//               funcType.paramTypes[i].tag
//             }, but got ${argTypes[i].tag}`,
//             term.term.args[i].info,
//           );
//         }
//       }
//       return funcType.returnType;
//     }
//     default: {
//       const _exhaustiveCheck: never = term.term;
//       throw new Error();
//     }
//   }
// }

// TODO going to need to handle name clashes
function getTypeFromContext(ctx: Context, varName: string): Type {
  const result = ctx.find((binding) => binding.name === varName);
  if (result) return result.type;
  const stdLibResult = lookupInStdLib(varName);
  if (stdLibResult) return stdLibResult.type;
  throw new Error(`Unbound variable: ${varName}`);
}

// function typesAreEquiv(t1: Type, t2: Type) {
//   if (t1.tag !== t2.tag) {
//     return false;
//   }
//   if (
//     t1.tag === "TyArrow" && t2.tag === "TyArrow" &&
//     t1.paramTypes.length === t2.paramTypes.length
//   ) {
//     for (let i = 0; i < t1.paramTypes.length; i++) {
//       if (!typesAreEquiv(t1.paramTypes[i], t2.paramTypes[i])) {
//         return false;
//       }
//     }
//     if (!typesAreEquiv(t1.returnType, t2.returnType)) {
//       return false;
//     }
//   }
//   return true;
// }

type Constraints = ([Type, Type])[];
type NextUniqVar = { varName: string; generator: () => NextUniqVar };
function uniqVarGen() {
  function helper(n: number) {
    return {
      varName: "?X_" + n,
      generator: () => helper(n + 1),
    };
  }
  return helper(0);
}

function recon(
  ctx: Context,
  nextUniqVarGenerator: NextUniqVar["generator"],
  term: Term,
): [Type, NextUniqVar["generator"], Constraints] {
  switch (term.term.tag) {
    case "TmBool": {
      return [{ tag: "TyBool" }, nextUniqVarGenerator, []];
    }
    case "TmInt": {
      return [{ tag: "TyInt" }, nextUniqVarGenerator, []];
    }
    case "TmStr": {
      return [{ tag: "TyStr" }, nextUniqVarGenerator, []];
    }
    case "TmVar": {
      const tyVar = getTypeFromContext(ctx, term.term.name);
      return [tyVar, nextUniqVarGenerator, []];
    }
    case "TmIf": {
      const [tyT1, nextUniqVar1, constr1] = recon(
        ctx,
        nextUniqVarGenerator,
        term.term.cond,
      );
      const [tyT2, nextUniqVar2, constr2] = recon(
        ctx,
        nextUniqVar1,
        term.term.then,
      );
      const [tyT3, nextUniqVar3, constr3] = recon(
        ctx,
        nextUniqVar2,
        term.term.else,
      );
      const newConstraints: Constraints = [
        [tyT1, { tag: "TyBool" }], // cond must have type bool
        [tyT2, tyT3], // then and else must have same type
      ];
      return [
        tyT3,
        nextUniqVar3,
        [...newConstraints, ...constr1, ...constr2, ...constr3],
      ];
    }
    case "TmLet": {
      const [tyT1, nextUniqVar1, constr1] = recon(
        ctx,
        nextUniqVarGenerator,
        term.term.val,
      );

      const [tyT2, nextUniqVar2, constr2] = recon(
        [{ name: term.term.name, type: tyT1 }, ...ctx],
        nextUniqVar1,
        term.term.body,
      );

      return [
        tyT2,
        nextUniqVar2,
        [...constr1, ...constr2], // TODO ?
      ];
    }
    case "TmAbs": {
      const paramsCtx: Context = [];
      let nextNextUniqVar = nextUniqVarGenerator;
      for (const p of term.term.params) {
        const { varName, generator } = nextNextUniqVar();
        paramsCtx.push(
          { name: p.name, type: p.typeAnn || { tag: "TyId", name: varName } },
        );
        nextNextUniqVar = generator;
      }
      const newCtx = [...paramsCtx, ...ctx];
      const [tyT2, nextUniqVar2, constr2] = recon(
        newCtx,
        nextNextUniqVar,
        term.term.body,
      );
      return [
        {
          tag: "TyArrow",
          paramTypes: paramsCtx.map((e) => e.type),
          returnType: tyT2,
        },
        nextUniqVar2,
        constr2,
      ];
    }
    case "TmApp": {
      const [tyT1, nextUniqVar1, constr1] = recon(
        ctx,
        nextUniqVarGenerator,
        term.term.func,
      );

      let argTypes = [];
      let nextNextUniqVar = nextUniqVar1;
      let argConstraints = [];
      for (const arg of term.term.args) {
        const [tyT2, nextUniqVar2, constr2] = recon(ctx, nextNextUniqVar, arg);
        argTypes.push(tyT2);
        nextNextUniqVar = nextUniqVar2;
        argConstraints.push(...constr2);
      }

      const { varName, generator } = nextNextUniqVar();
      const newConstraint: Constraints[0] = [
        tyT1,
        {
          tag: "TyArrow",
          paramTypes: argTypes,
          returnType: { tag: "TyId", name: varName },
        },
      ];

      return [
        { tag: "TyId", name: varName },
        generator,
        [newConstraint, ...constr1, ...argConstraints],
      ];
    }
    default: {
      const _exhaustiveCheck: never = term.term;
      throw new Error();
    }
  }
}

type Substitutions = ([Type, Type])[];

function substituteInTy(tyX: string, tyT: Type, tyS: Type) {
  function f(tyS: Type): Type {
    switch (tyS.tag) {
      case "TyBool":
      case "TyInt":
      case "TyStr":
        return tyS;
      case "TyArrow":
        return {
          tag: "TyArrow",
          paramTypes: tyS.paramTypes.map((p) => f(p)),
          returnType: f(tyS.returnType),
        };
      case "TyId": {
        if (tyS.name === tyX) {
          return tyT;
        } else {
          return tyS;
        }
      }
      default: {
        const _exhaustiveCheck: never = tyS;
        throw new Error();
      }
    }
  }
  return f(tyS);
}

function applySubst(constraints: Constraints, tyT: Type) {
  return constraints.reverse().reduce((tyS, [tyId, tyC2]) => {
    if (tyId.tag !== "TyId") throw new Error();
    return substituteInTy(tyId.name, tyC2, tyS);
  }, tyT);
}

function substituteInConstr(
  tyX: string,
  tyT: Type,
  constraints: Constraints,
): Substitutions {
  return constraints.map((
    [tyS1, tyS2],
  ) => [substituteInTy(tyX, tyT, tyS1), substituteInTy(tyX, tyT, tyS2)]);
}

function occursIn(tyX: string, tyT: Type) {
  function helper(tyT: Type): boolean {
    switch (tyT.tag) {
      case "TyBool":
      case "TyInt":
      case "TyStr":
        return false;
      case "TyArrow": {
        return tyT.paramTypes.filter((p) => helper(p)).length > 0 ||
          helper(tyT.returnType);
      }
      case "TyId": {
        return tyT.name === tyX;
      }
      default: {
        const _exhaustiveCheck: never = tyT;
        throw new Error();
      }
    }
  }
  return helper(tyT);
}

function unify(
  info: SourceInfo,
  ctx: Context,
  errMsg: string,
  constraints: Constraints,
) {
  function helper(constraints: Constraints): Constraints {
    if (constraints.length === 0) {
      return [];
    }
    const [tyS, tyT] = constraints[0];
    const restConstraints = constraints.slice(1);
    if (tyS.tag === "TyId" && tyT.tag === "TyId" && tyS.name === tyT.name) {
      return helper(restConstraints);
    } else if (tyT.tag === "TyId") {
      if (occursIn(tyT.name, tyS)) {
        throw new TypeError(errMsg + ": circular constraints", info);
      }
      return [
        [{ tag: "TyId", name: tyT.name }, tyS],
        ...helper(substituteInConstr(tyT.name, tyS, restConstraints)),
      ];
    } else if (tyS.tag === "TyId") {
      if (occursIn(tyS.name, tyT)) {
        throw new TypeError(errMsg + ": circular constraints", info);
      }
      return [
        [{ tag: "TyId", name: tyS.name }, tyT],
        ...helper(substituteInConstr(tyS.name, tyT, restConstraints)),
      ];
    } else if (tyS.tag === tyT.tag) {
      switch (tyS.tag) {
        case "TyBool":
        case "TyInt":
        case "TyStr":
          return helper(restConstraints);
        case "TyArrow": {
          if (tyT.tag !== "TyArrow") throw new Error();
          if (tyS.paramTypes.length !== tyT.paramTypes.length) {
            throw new TypeError("Unsolvable constraints", info);
          }
          const paramConstraints: Constraints = [];
          for (let i = 0; i < tyS.paramTypes.length; i++) {
            paramConstraints.push([tyS.paramTypes[i], tyT.paramTypes[i]]);
          }
          const returnConstraint: Constraints[0] = [
            tyS.returnType,
            tyT.returnType,
          ];
          return helper(
            [
              ...paramConstraints,
              returnConstraint,
              ...restConstraints,
            ],
          );
        }
        default: {
          const _exhaustiveCheck: never = tyS;
          throw new Error();
        }
      }
    } else if (tyS.tag !== tyT.tag) {
      throw new TypeError("Unsolvable constraints", info);
    } else {
      throw new Error();
    }
  }
  return helper(constraints);
}
