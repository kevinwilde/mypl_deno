import { TermWithInfo } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import { TypeError } from "./exceptions.ts";
import { SourceInfo } from "./lexer.ts";
import { genUniqRowVar, genUniqTypeVar, omit, prettyPrint } from "./utils.ts";

type Type =
  | { tag: "TyBool" }
  | { tag: "TyInt" }
  | { tag: "TyStr" }
  | { tag: "TyList"; elementType: TypeWithInfo }
  | { tag: "TyRecord"; rowExp: RowExpression }
  | { tag: "TyArrow"; paramTypes: TypeWithInfo[]; returnType: TypeWithInfo }
  | { tag: "TyId"; name: symbol };

type RowExpression = {
  name: symbol | "emptyrow";
  fieldTypes: Record<string, TypeWithInfo>;
};

type RowExpressionWithInfo = {
  info: SourceInfo;
  row: RowExpression;
};

export type TypeWithInfo = {
  info: SourceInfo;
  type: Type;
};

type Context = { name: string; type: TypeWithInfo }[];

type Constraint = {
  constraintType: "type";
  constraint: [TypeWithInfo, TypeWithInfo];
} | {
  constraintType: "row";
  constraint: [RowExpressionWithInfo, RowExpressionWithInfo];
};
type Constraints = Constraint[];

export function typeCheck(term: TermWithInfo) {
  const [type, constraints] = recon([], term);
  const resultConstraints = unify(constraints);
  const finalType = applySubst(
    resultConstraints.filter((c) => c.constraintType === "type"), // at this point we should be able to determine finalType just by looking at type constraints since we've unified everything TODO I just made this up, and I don't know if it's right
    type,
  );
  return finalType;
}

function getTypeFromContext(
  ctx: Context,
  varName: string,
  info: SourceInfo,
): Type {
  const result = ctx.find((binding) => binding.name === varName);
  if (result) return result.type.type;
  const stdLibResult = lookupInStdLib(varName, info);
  if (stdLibResult) return stdLibResult.type;
  throw new Error(`Unbound variable: ${varName}`);
}

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
      const tyVar = getTypeFromContext(ctx, term.term.name, term.info);
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
              type: { tag: "TyId", name: genUniqTypeVar() },
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
        {
          constraintType: "type",
          constraint: [ // car must be element type of cdr
            {
              info: tyT1.info,
              type: {
                tag: "TyList",
                elementType: tyT1,
              },
            },
            tyT2,
          ],
        },
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
        {
          info: term.info,
          type: {
            tag: "TyRecord",
            rowExp: { name: "emptyrow", fieldTypes },
          },
        },
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
        (term.term.fieldName in tyT1.type.rowExp.fieldTypes)
      ) {
        resultType = tyT1.type.rowExp.fieldTypes[term.term.fieldName];
      } else {
        resultType = {
          info: term.term.record.info, // TODO not very granular info
          type: { tag: "TyId", name: genUniqTypeVar() },
        };
      }

      const newConstraints: Constraints = [
        {
          constraintType: "type",
          constraint: [
            {
              info: term.term.record.info,
              type: {
                tag: "TyRecord",
                rowExp: {
                  name: genUniqRowVar(),
                  fieldTypes: { [term.term.fieldName]: resultType },
                },
              },
            },
            tyT1,
          ],
        },
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
        {
          constraintType: "type",
          constraint: [
            { info: term.term.cond.info, type: { tag: "TyBool" } },
            tyT1, // cond must have type bool
          ],
        },
        {
          constraintType: "type",
          constraint: [tyT2, tyT3], // then and else must have same type
        },
      ];
      return [
        tyT3,
        [...newConstraints, ...constr1, ...constr2, ...constr3],
      ];
    }
    case "TmLet": {
      // 1 - value
      // 2 - body
      const unknownTypeForRecursion: Type = {
        tag: "TyId",
        name: genUniqTypeVar(),
      };
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
          {
            constraintType: "type",
            constraint: [
              { info: term.term.val.info, type: unknownTypeForRecursion },
              tyT1,
            ],
          },
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
              {
                info: term.info,
                type: { tag: "TyId", name: genUniqTypeVar() },
              }),
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

      const tyIdSym = genUniqTypeVar();
      const newConstraint: Constraints[0] = {
        constraintType: "type",
        constraint: [
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
        ],
      };

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
        const substitutedFieldTypes: typeof tyS.rowExp.fieldTypes = {};
        for (
          const [fieldName, fieldType] of Object.entries(tyS.rowExp.fieldTypes)
        ) {
          substitutedFieldTypes[fieldName] = {
            info: fieldType.info,
            type: helper(fieldType.type),
          };
        }
        return {
          tag: "TyRecord",
          rowExp: { name: tyS.rowExp.name, fieldTypes: substitutedFieldTypes },
        };
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

/**
 * @param pX symbol of row to subsitute
 * @param pR "known row value" of pX / constraint on pX
 * @param pS type to substitute inside of
 */
function substituteInRow(
  pX: symbol,
  pR: RowExpression,
  pS: RowExpression,
): RowExpression {
  if (pS.name === pX) {
    return {
      name: pR.name,
      fieldTypes: { ...pR.fieldTypes, ...pS.fieldTypes },
    };
  } else {
    return pS;
  }
}

function applySubst(constraints: Constraints, tyT: TypeWithInfo) {
  return constraints.reverse().reduce((tyS, constraint) => {
    if (constraint.constraintType !== "type") {
      // return constraint;
      const [pId, pC2] = constraint.constraint;
      // if (pId.row.name === 'emptyrow') throw new Error();
      // return substituteInRow(pId.row.name, pC2.row, tyS)
      throw new Error();
    }
    const [tyId, tyC2] = constraint.constraint;
    if (tyId.type.tag !== "TyId") throw new Error();
    return substituteInTy(tyId.type.name, tyC2.type, tyS);
  }, tyT.type);
}

function substituteInConstr(
  tyX: symbol,
  tyT: Type,
  constraints: Constraints,
): Constraints {
  return constraints.map((c) => {
    if (c.constraintType !== "type") {
      return c;
    }
    const [tyS1, tyS2] = c.constraint;
    return {
      constraintType: "type",
      constraint: [
        { info: tyS1.info, type: substituteInTy(tyX, tyT, tyS1.type) },
        { info: tyS2.info, type: substituteInTy(tyX, tyT, tyS2.type) },
      ],
    };
  });
}

function substituteInRowConstr(
  pX: symbol,
  pR: RowExpression,
  constraints: Constraints,
): Constraints {
  return constraints.map((c) => {
    if (c.constraintType !== "row") {
      return c;
    }
    const [pS1, pS2] = c.constraint;
    return {
      constraintType: "row",
      constraint: [
        { info: pS1.info, row: substituteInRow(pX, pR, pS1.row) },
        { info: pS2.info, row: substituteInRow(pX, pR, pS2.row) },
      ],
    };
  });
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
        for (const [_, fieldType] of Object.entries(tyT.rowExp.fieldTypes)) {
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

function occursInRow(pX: symbol, pR: RowExpression) {
  if (pR.name === "emptyrow") {
    return false;
  }
  return pX === pR.name;
}

function unify(constraints: Constraints) {
  function helper(constraints: Constraints): Constraints {
    if (constraints.length === 0) {
      return [];
    }
    switch (constraints[0].constraintType) {
      case "type": {
        const [tyS, tyT] = constraints[0].constraint;
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
            ...helper(
              substituteInConstr(tyT.type.name, tyS.type, restConstraints),
            ),
            {
              constraintType: "type",
              constraint: [tyT, tyS],
            },
          ];
        } else if (tyS.type.tag === "TyId") {
          const flippedConstraint: Constraint = {
            constraintType: "type",
            constraint: [tyT, tyS],
          };
          return helper([flippedConstraint, ...restConstraints]);
        } else if (tyS.type.tag === tyT.type.tag) {
          switch (tyS.type.tag) {
            case "TyBool":
            case "TyInt":
            case "TyStr":
              return helper(restConstraints);
            case "TyList": {
              if (tyT.type.tag !== "TyList") throw new Error();
              const elementConstraint: Constraints[0] = {
                constraintType: "type",
                constraint: [
                  tyS.type.elementType,
                  tyT.type.elementType,
                ],
              };
              return helper([elementConstraint, ...restConstraints]);
            }
            case "TyRecord": {
              if (tyT.type.tag !== "TyRecord") throw new Error();
              const rowsConstraint: Constraint = {
                constraintType: "row",
                constraint: [
                  { info: tyS.info, row: tyS.type.rowExp },
                  { info: tyT.info, row: tyT.type.rowExp },
                ],
              };
              return helper([rowsConstraint, ...restConstraints]);
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
                paramConstraints.push({
                  constraintType: "type",
                  constraint: [
                    tyS.type.paramTypes[i],
                    tyT.type.paramTypes[i],
                  ],
                });
              }
              const returnConstraint: Constraints[0] = {
                constraintType: "type",
                constraint: [
                  tyS.type.returnType,
                  tyT.type.returnType,
                ],
              };
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
      case "row": {
        const [pR, pS] = constraints[0].constraint;
        const restConstraints = constraints.slice(1);
        if (
          pR.row.name !== "emptyrow" &&
          Object.entries(pR.row.fieldTypes).length === 0
        ) {
          if (occursInRow(pR.row.name, pS.row)) {
            throw new TypeError(`circular constraints`, pS.info);
          }
          return [
            ...helper(
              substituteInRowConstr(pR.row.name, pS.row, restConstraints),
            ),
            { constraintType: "row", constraint: [pS, pR] },
          ];
        } else if (
          pS.row.name !== "emptyrow" &&
          Object.entries(pS.row.fieldTypes).length === 0
        ) {
          const flippedConstraint: Constraint = {
            constraintType: "row",
            constraint: [pS, pR],
          };
          return helper([flippedConstraint, ...restConstraints]);
        } else if (pR.row.name === "emptyrow" && pS.row.name === "emptyrow") {
          // fields must be _exactly_ the same
          // ...same length
          if (
            Object.entries(pR.row.fieldTypes).length !==
              Object.entries(pS.row.fieldTypes).length
          ) {
            throw new TypeError(
              `Expected ${
                Object.entries(pR.row.fieldTypes).length
              } fields but got ${Object.entries(pS.row.fieldTypes).length}`,
              pS.info,
            );
          }
          // ...all fields in pR must be in pS
          for (const [fieldName, _] of Object.entries(pR.row.fieldTypes)) {
            if (!(fieldName in pS.row.fieldTypes)) {
              throw new TypeError(`Expected field ${fieldName}`, pS.info);
            }
          }
          // ...all fields in pS must be in pR
          for (const [fieldName, _] of Object.entries(pS.row.fieldTypes)) {
            if (!(fieldName in pR.row.fieldTypes)) {
              throw new TypeError(`Expected field ${fieldName}`, pR.info);
            }
          }

          const fieldConstraints: Constraints = [];
          for (const [fieldName, _] of Object.entries(pR.row.fieldTypes)) {
            fieldConstraints.push({
              constraintType: "type",
              constraint: [
                pR.row.fieldTypes[fieldName],
                pS.row.fieldTypes[fieldName],
              ],
            });
          }
          return helper([...fieldConstraints, ...restConstraints]);
        } else if (pR.row.name === "emptyrow") {
          // pS fieldTypes must be subset of pR fieldTypes
          if (
            Object.entries(pS.row.fieldTypes).length >
              Object.entries(pR.row.fieldTypes).length
          ) {
            throw new TypeError(
              `Unsolvable constraints, fields not a subset`,
              pS.info,
            );
          }
          for (const [fieldName, _] of Object.entries(pS.row.fieldTypes)) {
            if (!(fieldName in pR.row.fieldTypes)) {
              throw new TypeError(`Expected field ${fieldName}`, pR.info);
            }
          }

          const commonFieldConstraints: Constraints = [];
          for (const [fieldName, _] of Object.entries(pS.row.fieldTypes)) {
            commonFieldConstraints.push({
              constraintType: "type",
              constraint: [
                pR.row.fieldTypes[fieldName],
                pS.row.fieldTypes[fieldName],
              ],
            });
          }
          const constraintOnExtraFields: Constraint = {
            constraintType: "row",
            constraint: [
              { info: pS.info, row: { name: pS.row.name, fieldTypes: {} } },
              {
                info: pS.info,
                row: {
                  name: "emptyrow",
                  fieldTypes: omit(
                    pR.row.fieldTypes,
                    Object.keys(pR.row.fieldTypes),
                  ),
                },
              },
            ],
          };
          return helper(
            [
              ...commonFieldConstraints,
              constraintOnExtraFields,
              ...restConstraints,
            ],
          );
        } else if (pS.row.name === "emptyrow") {
          const flippedConstraint: Constraint = {
            constraintType: "row",
            constraint: [pS, pR],
          };
          return helper([flippedConstraint, ...restConstraints]);
        } else {
          const commonFieldNames: string[] = [];
          for (const [fieldName, _] of Object.entries(pR.row.fieldTypes)) {
            if (fieldName in pS.row.fieldTypes) {
              commonFieldNames.push(fieldName);
            }
          }

          const commonFieldConstraints: Constraints = [];
          for (const fieldName of commonFieldNames) {
            commonFieldConstraints.push({
              constraintType: "type",
              constraint: [
                pR.row.fieldTypes[fieldName],
                pS.row.fieldTypes[fieldName],
              ],
            });
          }

          const freshRowVar = genUniqRowVar();
          const pRNew: RowExpression = {
            name: freshRowVar,
            fieldTypes: omit(pR.row.fieldTypes, commonFieldNames),
          };
          const pSNew: RowExpression = {
            name: freshRowVar,
            fieldTypes: omit(pS.row.fieldTypes, commonFieldNames),
          };
          if (occursInRow(pR.row.name, pRNew)) {
            throw new TypeError(`circular constraints`, pR.info);
          }
          if (occursInRow(pS.row.name, pSNew)) {
            throw new TypeError(`circular constraints`, pS.info);
          }

          return helper(
            substituteInRowConstr(
              pR.row.name,
              pRNew,
              substituteInRowConstr(pS.row.name, pSNew, [
                ...commonFieldConstraints,
                ...restConstraints,
              ]),
            ),
          );
        }
      }
      default: {
        const _exhaustiveCheck: never = constraints[0];
        throw new Error();
      }
    }
  }
  return helper(constraints);
}
