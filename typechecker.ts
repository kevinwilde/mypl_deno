import { TermWithInfo } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import { TypeError } from "./exceptions.ts";
import { SourceInfo } from "./lexer.ts";
import { genUniq, prettyPrint } from "./utils.ts";

type Type =
  | { tag: "TyBool" }
  | { tag: "TyInt" }
  | { tag: "TyStr" }
  | { tag: "TyList"; elementType: TypeWithInfo }
  | { tag: "TyRecord"; fieldTypes: Record<string, TypeWithInfo> }
  | { tag: "TyArrow"; paramTypes: TypeWithInfo[]; returnType: TypeWithInfo }
  | { tag: "TyId"; name: symbol };

export type TypeWithInfo = {
  info: SourceInfo;
  type: Type;
};

type Context = { name: string; type: TypeWithInfo }[];

export function typeCheck(term: TermWithInfo) {
  const [type, constraints] = recon([], term);
  const resultConstraints = unify(constraints);
  const finalType = applySubst(resultConstraints, type);
  return finalType;
}

// TODO going to need to handle name clashes
function getTypeFromContext(ctx: Context, varName: string): Type {
  const result = ctx.find((binding) => binding.name === varName);
  if (result) return result.type.type;
  const stdLibResult = lookupInStdLib(varName);
  if (stdLibResult) return stdLibResult.type;
  throw new Error(`Unbound variable: ${varName}`);
}

type Constraints = ([TypeWithInfo, TypeWithInfo])[];

function recon(
  ctx: Context,
  term: TermWithInfo,
): [TypeWithInfo, Constraints] {
  switch (term.term.tag) {
    case "TmBool": {
      return [
        { info: term.info, type: { tag: "TyBool" } },
        [],
      ];
    }
    case "TmInt": {
      return [
        { info: term.info, type: { tag: "TyInt" } },
        [],
      ];
    }
    case "TmStr": {
      return [
        { info: term.info, type: { tag: "TyStr" } },
        [],
      ];
    }
    case "TmVar": {
      const tyVar = getTypeFromContext(ctx, term.term.name);
      return [{ info: term.info, type: tyVar }, []];
    }
    case "TmEmpty": {
      return [
        {
          info: term.info,
          type: {
            tag: "TyList",
            elementType: {
              info: term.info,
              type: { tag: "TyId", name: genUniq() },
            },
          },
        },
        [],
      ];
    }
    case "TmCons": {
      // 1 - car
      // 2 - cdr
      const [tyT1, constr1] = recon(
        ctx,
        term.term.car,
      );
      const [tyT2, constr2] = recon(
        ctx,
        term.term.cdr,
      );
      const newConstraints: Constraints = [
        [ // car must be element type of cdr
          {
            info: tyT1.info,
            type: {
              tag: "TyList",
              elementType: tyT1,
            },
          },
          tyT2,
        ],
      ];
      return [
        { info: term.info, type: { tag: "TyList", elementType: tyT1 } },
        [...newConstraints, ...constr1, ...constr2],
      ];
    }
    case "TmRecord": {
      const fieldTypes: Record<string, TypeWithInfo> = {};
      const fieldConstraints = [];
      for (const [fieldName, fieldTerm] of Object.entries(term.term.fields)) {
        const [tyF, constr2] = recon(
          ctx,
          fieldTerm,
        );
        fieldTypes[fieldName] = tyF;
        fieldConstraints.push(...constr2);
      }
      return [
        { info: term.info, type: { tag: "TyRecord", fieldTypes } },
        fieldConstraints,
      ];
    }
    case "TmProj": {
      // 1 - record
      const [tyT1, constr1] = recon(
        ctx,
        term.term.record,
      );
      let resultType: TypeWithInfo;
      if (
        tyT1.type.tag === "TyRecord" &&
        (term.term.fieldName in tyT1.type.fieldTypes)
      ) {
        resultType = tyT1.type.fieldTypes[term.term.fieldName];
      } else {
        // TODO this is broken and in general a hard problem to solve for the
        // exact reasons described in the solution to Pierce 22.5.6
        resultType = {
          info: term.term.record.info, // TODO not very granular info
          type: { tag: "TyId", name: genUniq() },
        };
      }

      const newConstraints: Constraints = [
        [
          {
            info: term.term.record.info,
            type: {
              tag: "TyRecord",
              fieldTypes: { [term.term.fieldName]: resultType },
            },
          },
          tyT1,
        ],
      ];

      return [
        resultType,
        [...newConstraints, ...constr1],
      ];
    }
    case "TmIf": {
      // 1 - cond
      // 2 - then
      // 3 - else
      const [tyT1, constr1] = recon(
        ctx,
        term.term.cond,
      );
      const [tyT2, constr2] = recon(
        ctx,
        term.term.then,
      );
      const [tyT3, constr3] = recon(
        ctx,
        term.term.else,
      );
      const newConstraints: Constraints = [
        [{ info: term.term.cond.info, type: { tag: "TyBool" } }, tyT1], // cond must have type bool
        [tyT2, tyT3], // then and else must have same type
      ];
      return [
        tyT3,
        [...newConstraints, ...constr1, ...constr2, ...constr3],
      ];
    }
    case "TmLet": {
      // 1 - value
      // 2 - body
      const unknownTypeForRecursion: Type = { tag: "TyId", name: genUniq() };
      const [tyT1, constr1] = recon(
        [
          { // Allows recursion by saying this name is in context, with type unknown as of now
            name: term.term.name,
            type: {
              info: term.info,
              type: unknownTypeForRecursion,
            },
          },
          ...ctx,
        ],
        term.term.val,
      );

      const [tyT2, constr2] = recon(
        [{ name: term.term.name, type: tyT1 }, ...ctx],
        term.term.body,
      );

      return [
        tyT2,
        [
          // Constraint that the unknown type we referenced above, matches the
          // type determined for the value of the let expression
          [{ info: term.term.val.info, type: unknownTypeForRecursion }, tyT1],
          ...constr1,
          ...constr2,
        ], // TODO ?
      ];
    }
    case "TmAbs": {
      // paramTypes
      // 2 - body
      const paramsCtx: Context = [];
      for (const p of term.term.params) {
        paramsCtx.push(
          {
            name: p.name,
            type: (p.typeAnn ||
              { info: term.info, type: { tag: "TyId", name: genUniq() } }),
          },
        );
      }
      const newCtx = [...paramsCtx, ...ctx];
      const [tyT2, constr2] = recon(
        newCtx,
        term.term.body,
      );
      return [
        {
          info: term.info,
          type: {
            tag: "TyArrow",
            paramTypes: paramsCtx.map((e) => e.type),
            returnType: tyT2,
          },
        },
        constr2,
      ];
    }
    case "TmApp": {
      // 1 - func
      // argTypes
      const [tyT1, constr1] = recon(
        ctx,
        term.term.func,
      );

      let argTypes = [];
      let argConstraints = [];
      for (const arg of term.term.args) {
        const [tyT2, constr2] = recon(ctx, arg);
        argTypes.push(tyT2);
        argConstraints.push(...constr2);
      }

      const tyIdSym = genUniq();
      const newConstraint: Constraints[0] = [
        tyT1,
        {
          info: term.info,
          type: {
            tag: "TyArrow",
            paramTypes: argTypes,
            returnType: {
              info: term.info,
              type: { tag: "TyId", name: tyIdSym },
            },
          },
        },
      ];

      return [
        { info: term.info, type: { tag: "TyId", name: tyIdSym } },
        [newConstraint, ...constr1, ...argConstraints],
      ];
    }
    default: {
      const _exhaustiveCheck: never = term.term;
      throw new Error();
    }
  }
}

/**
 * @param tyX symbol of type to subsitute
 * @param tyT "known type" of tyX / constraint on tyX
 * @param tyS type to substitute inside of
 */
function substituteInTy(tyX: symbol, tyT: Type, tyS: Type) {
  function helper(tyS: Type): Type {
    switch (tyS.tag) {
      case "TyBool":
      case "TyInt":
      case "TyStr":
        return tyS;
      case "TyList":
        return {
          tag: "TyList",
          elementType: {
            info: tyS.elementType.info,
            type: helper(tyS.elementType.type),
          },
        };
      case "TyRecord": {
        const substitutedFieldTypes: typeof tyS.fieldTypes = {};
        for (const [fieldName, fieldType] of Object.entries(tyS.fieldTypes)) {
          substitutedFieldTypes[fieldName] = {
            info: fieldType.info,
            type: helper(fieldType.type),
          };
        }
        return { tag: "TyRecord", fieldTypes: substitutedFieldTypes };
      }
      case "TyArrow":
        return {
          tag: "TyArrow",
          paramTypes: tyS.paramTypes.map((p) => ({
            info: p.info,
            type: helper(p.type),
          })),
          returnType: {
            info: tyS.returnType.info,
            type: helper(tyS.returnType.type),
          },
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
  return helper(tyS);
}

function applySubst(constraints: Constraints, tyT: TypeWithInfo) {
  return constraints.reverse().reduce((tyS, [tyId, tyC2]) => {
    if (tyId.type.tag !== "TyId") throw new Error();
    return substituteInTy(tyId.type.name, tyC2.type, tyS);
  }, tyT.type);
}

function substituteInConstr(
  tyX: symbol,
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

function occursIn(tyX: symbol, tyT: Type) {
  function helper(tyT: Type): boolean {
    switch (tyT.tag) {
      case "TyBool":
      case "TyInt":
      case "TyStr":
        return false;
      case "TyList":
        return helper(tyT.elementType.type);
      case "TyRecord": {
        for (const [_, fieldType] of Object.entries(tyT.fieldTypes)) {
          if (helper(fieldType.type)) {
            return true;
          }
        }
        return false;
      }
      case "TyArrow":
        return tyT.paramTypes.filter((p) => helper(p.type)).length > 0 ||
          helper(tyT.returnType.type);
      case "TyId":
        return tyT.name === tyX;
      default: {
        const _exhaustiveCheck: never = tyT;
        throw new Error();
      }
    }
  }
  return helper(tyT);
}

function unify(constraints: Constraints) {
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
        ...helper(substituteInConstr(tyT.type.name, tyS.type, restConstraints)),
        [{ info: tyT.info, type: { tag: "TyId", name: tyT.type.name } }, tyS],
      ];
    } else if (tyS.type.tag === "TyId") {
      if (occursIn(tyS.type.name, tyT.type)) {
        throw new TypeError(`circular constraints`, tyT.info); // TODO tyT.info or tyS.info?
      }
      return [
        ...helper(substituteInConstr(tyS.type.name, tyT.type, restConstraints)),
        [{ info: tyS.info, type: { tag: "TyId", name: tyS.type.name } }, tyT],
      ];
    } else if (tyS.type.tag === tyT.type.tag) {
      switch (tyS.type.tag) {
        case "TyBool":
        case "TyInt":
        case "TyStr":
          return helper(restConstraints);
        case "TyList": {
          if (tyT.type.tag !== "TyList") throw new Error();
          const elementConstraint: Constraints[0] = [
            tyS.type.elementType,
            tyT.type.elementType,
          ];
          return helper([elementConstraint, ...restConstraints]);
        }
        case "TyRecord": {
          if (tyT.type.tag !== "TyRecord") throw new Error();
          const fieldConstraints: Constraints = [];
          for (const [fieldName, _] of Object.entries(tyS.type.fieldTypes)) {
            if (!(fieldName in tyT.type.fieldTypes)) {
              throw new TypeError(
                `Unsolvable constraints: expected field ${fieldName}`,
                tyT.info,
              );
            }
            fieldConstraints.push([
              {
                info: tyS.type.fieldTypes[fieldName].info,
                type: tyS.type.fieldTypes[fieldName].type,
              },
              {
                info: tyT.type.fieldTypes[fieldName].info,
                type: tyT.type.fieldTypes[fieldName].type,
              },
            ]);
          }
          return helper([...fieldConstraints, ...restConstraints]);
        }
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
            paramConstraints.push([
              tyS.type.paramTypes[i],
              tyT.type.paramTypes[i],
            ]);
          }
          const returnConstraint: Constraints[0] = [
            tyS.type.returnType,
            tyT.type.returnType,
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
