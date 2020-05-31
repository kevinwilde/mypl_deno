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
  const [type, _, constraints] = recon([], uniqVarGen, term);
  const resultConstraints = unify(term.info, [], "hi kevin", constraints);
  const finalType = applySubst(resultConstraints, type);
  return finalType;
}

// TODO going to need to handle name clashes
function getTypeFromContext(ctx: Context, varName: string): Type {
  const result = ctx.find((binding) => binding.name === varName);
  if (result) return result.type;
  const stdLibResult = lookupInStdLib(varName);
  if (stdLibResult) return stdLibResult.type;
  throw new Error(`Unbound variable: ${varName}`);
}

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
