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

type TypeWithInfo = {
  info: SourceInfo;
  type: Type;
};

type Context = { name: string; type: Type }[];

export function typeCheck(term: Term) {
  const [type, _, constraints] = recon([], uniqVarGen, term);
  const resultConstraints = unify(constraints);
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

type Constraints = ([TypeWithInfo, TypeWithInfo])[];
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
): [TypeWithInfo, NextUniqVar["generator"], Constraints] {
  switch (term.term.tag) {
    case "TmBool": {
      return [
        { info: term.info, type: { tag: "TyBool" } },
        nextUniqVarGenerator,
        [],
      ];
    }
    case "TmInt": {
      return [
        { info: term.info, type: { tag: "TyInt" } },
        nextUniqVarGenerator,
        [],
      ];
    }
    case "TmStr": {
      return [
        { info: term.info, type: { tag: "TyStr" } },
        nextUniqVarGenerator,
        [],
      ];
    }
    case "TmVar": {
      const tyVar = getTypeFromContext(ctx, term.term.name);
      return [{ info: term.info, type: tyVar }, nextUniqVarGenerator, []];
    }
    case "TmIf": {
      // 1 - cond
      // 2 - then
      // 3 - else
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
        [{ info: term.term.cond.info, type: { tag: "TyBool" } }, tyT1], // cond must have type bool
        [tyT2, tyT3], // then and else must have same type
      ];
      return [
        tyT3,
        nextUniqVar3,
        [...newConstraints, ...constr1, ...constr2, ...constr3],
      ];
    }
    case "TmLet": {
      // 1 - value
      // 2 - body
      const [tyT1, nextUniqVar1, constr1] = recon(
        ctx,
        nextUniqVarGenerator,
        term.term.val,
      );

      const [tyT2, nextUniqVar2, constr2] = recon(
        [{ name: term.term.name, type: tyT1.type }, ...ctx],
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
      // paramTypes
      // 2 - body
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
          info: term.info,
          type: {
            tag: "TyArrow",
            paramTypes: paramsCtx.map((e) => e.type),
            returnType: tyT2.type,
          },
        },
        nextUniqVar2,
        constr2,
      ];
    }
    case "TmApp": {
      // 1 - func
      // argTypes
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
          info: term.info,
          type: {
            tag: "TyArrow",
            paramTypes: argTypes.map((a) => a.type),
            returnType: { tag: "TyId", name: varName },
          },
        },
      ];

      return [
        { info: term.info, type: { tag: "TyId", name: varName } },
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

function applySubst(constraints: Constraints, tyT: TypeWithInfo) {
  return constraints.reverse().reduce((tyS, [tyId, tyC2]) => {
    if (tyId.type.tag !== "TyId") throw new Error();
    return substituteInTy(tyId.type.name, tyC2.type, tyS);
  }, tyT.type);
}

function substituteInConstr(
  tyX: string,
  tyT: Type,
  constraints: Constraints,
): Constraints {
  return constraints.map((
    [tyS1, tyS2],
  ) => [
    { info: tyS1.info, type: substituteInTy(tyX, tyT, tyS1.type) },
    { info: tyS2.info, type: substituteInTy(tyX, tyT, tyS2.type) },
  ]);
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
  constraints: Constraints,
) {
  function helper(constraints: Constraints): Constraints {
    if (constraints.length === 0) {
      return [];
    }
    const [tyS, tyT] = constraints[0];
    const restConstraints = constraints.slice(1);
    if (
      tyS.type.tag === "TyId" && tyT.type.tag === "TyId" &&
      tyS.type.name === tyT.type.name
    ) {
      return helper(restConstraints);
    } else if (tyT.type.tag === "TyId") {
      if (occursIn(tyT.type.name, tyS.type)) {
        throw new TypeError(`circular constraints`, tyS.info); // TODO tyT.info or tyS.info?
      }
      return [
        [{ info: tyT.info, type: { tag: "TyId", name: tyT.type.name } }, tyS],
        ...helper(substituteInConstr(tyT.type.name, tyS.type, restConstraints)),
      ];
    } else if (tyS.type.tag === "TyId") {
      if (occursIn(tyS.type.name, tyT.type)) {
        throw new TypeError(`circular constraints`, tyT.info); // TODO tyT.info or tyS.info?
      }
      return [
        [{ info: tyS.info, type: { tag: "TyId", name: tyS.type.name } }, tyT],
        ...helper(substituteInConstr(tyS.type.name, tyT.type, restConstraints)),
      ];
    } else if (tyS.type.tag === tyT.type.tag) {
      switch (tyS.type.tag) {
        case "TyBool":
        case "TyInt":
        case "TyStr":
          return helper(restConstraints);
        case "TyArrow": {
          if (tyT.type.tag !== "TyArrow") throw new Error();
          if (tyS.type.paramTypes.length !== tyT.type.paramTypes.length) {
            throw new TypeError(
              `Unsolvable constraints: expected ${tyS.type.paramTypes.length} arguments but got ${tyT.type.paramTypes.length}`,
              tyT.info,
            );
          }
          const paramConstraints: Constraints = [];
          for (let i = 0; i < tyS.type.paramTypes.length; i++) {
            paramConstraints.push(
              [
                { info: tyS.info, type: tyS.type.paramTypes[i] },
                { info: tyT.info, type: tyT.type.paramTypes[i] },
              ],
            );
          }
          const returnConstraint: Constraints[0] = [
            { info: tyS.info, type: tyS.type.returnType },
            { info: tyT.info, type: tyT.type.returnType },
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
          const _exhaustiveCheck: never = tyS.type;
          throw new Error();
        }
      }
    } else if (tyS.type.tag !== tyT.type.tag) {
      throw new TypeError(
        `Unsolvable constraints, expected type ${tyS.type.tag}, but got ${tyT.type.tag}`,
        tyT.info,
      );
    } else {
      throw new Error();
    }
  }
  return helper(constraints);
}
