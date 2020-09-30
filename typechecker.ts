import { Term } from "./parser.ts";
import { lookupInStdLib } from "./stdlib.ts";
import {
  genUniqRowVar,
  genUniqTypeVar,
  omit,
  assertNever,
} from "./utils.ts";

export type Type =
  | { tag: "TyBool" }
  | { tag: "TyInt" }
  | { tag: "TyStr" }
  | { tag: "TyVoid" }
  | { tag: "TyRef"; valType: Type }
  | { tag: "TyList"; elementType: Type }
  | { tag: "TyRecord"; rowExp: RowExpression }
  | { tag: "TyArrow"; paramTypes: Type[]; returnType: Type }
  | { tag: "TyId"; name: symbol };

type RowExpression = {
  name: symbol | "emptyrow";
  fieldTypes: Record<string, Type>;
};

type Context = { name: string; type: Type }[];

type Constraint = {
  constraintType: "type";
  constraint: [Type, Type];
} | {
  constraintType: "row";
  constraint: [RowExpression, RowExpression];
};
type Constraints = Constraint[];

export function typeCheck(term: Term) {
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
): Type {
  const result = ctx.find((binding) => binding.name === varName);
  if (result) return result.type;
  const stdLibResult = lookupInStdLib(varName);
  if (stdLibResult) return stdLibResult.type;
  throw new Error(`Unbound variable: ${varName}`);
}

function recon(
  ctx: Context,
  term: Term,
): [Type, Constraints] {
  switch (term.tag) {
    case "TmBool": {
      return [{ tag: "TyBool" }, []];
    }
    case "TmInt": {
      return [{ tag: "TyInt" }, []];
    }
    case "TmStr": {
      return [{ tag: "TyStr" }, []];
    }
    case "TmVar": {
      const tyVar = getTypeFromContext(ctx, term.name);
      return [tyVar, []];
    }
    case "TmRef": {
      const [tyT1, constr1] = recon(ctx, term.val);
      return [{ tag: "TyRef", valType: tyT1 }, constr1];
    }
    case "TmEmpty": {
      return [
        {
          tag: "TyList",
          elementType: { tag: "TyId", name: genUniqTypeVar() },
        },
        [],
      ];
    }
    case "TmCons": {
      // 1 - car
      // 2 - cdr
      const [tyT1, constr1] = recon(ctx, term.car);
      const [tyT2, constr2] = recon(ctx, term.cdr);
      const newConstraints: Constraints = [
        {
          constraintType: "type",
          constraint: [ // car must be element type of cdr
            { tag: "TyList", elementType: tyT1 },
            tyT2,
          ],
        },
      ];
      return [
        { tag: "TyList", elementType: tyT1 },
        [...newConstraints, ...constr1, ...constr2],
      ];
    }
    case "TmRecord": {
      const fieldTypes: Record<string, Type> = {};
      const fieldConstraints = [];
      for (const [fieldName, fieldTerm] of Object.entries(term.fields)) {
        const [tyF, constr2] = recon(ctx, fieldTerm);
        fieldTypes[fieldName] = tyF;
        fieldConstraints.push(...constr2);
      }
      return [
        { tag: "TyRecord", rowExp: { name: "emptyrow", fieldTypes } },
        fieldConstraints,
      ];
    }
    case "TmProj": {
      // 1 - record
      const [tyT1, constr1] = recon(ctx, term.record);
      let resultType: Type;
      if (
        tyT1.tag === "TyRecord" &&
        (term.fieldName in tyT1.rowExp.fieldTypes)
      ) {
        resultType = tyT1.rowExp.fieldTypes[term.fieldName];
      } else {
        resultType = { tag: "TyId", name: genUniqTypeVar() };
      }

      const newConstraints: Constraints = [
        {
          constraintType: "type",
          constraint: [
            {
              tag: "TyRecord",
              rowExp: {
                name: genUniqRowVar(),
                fieldTypes: { [term.fieldName]: resultType },
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
      const [tyT1, constr1] = recon(ctx, term.cond);
      const [tyT2, constr2] = recon(ctx, term.then);
      const [tyT3, constr3] = recon(ctx, term.else);
      const newConstraints: Constraints = [
        {
          constraintType: "type",
          constraint: [{ tag: "TyBool" }, tyT1], // cond must have type bool
        },
        {
          constraintType: "type",
          constraint: [tyT2, tyT3], // then and else must have same type
        },
      ];
      return [tyT3, [...newConstraints, ...constr1, ...constr2, ...constr3]];
    }
    case "TmLet": {
      // 1 - value
      // 2 - body
      const unknownTypeForRecursion: Type = {
        tag: "TyId",
        name: genUniqTypeVar(),
      };
      const [tyT1, constr1] = recon(
        [ // Allows recursion by saying this name is in context, with type unknown as of now
          { name: term.name, type: unknownTypeForRecursion },
          ...ctx,
        ],
        term.val,
      );

      const [tyT2, constr2] = recon(
        [{ name: term.name, type: tyT1 }, ...ctx],
        term.body,
      );

      return [
        tyT2,
        [
          // Constraint that the unknown type we referenced above, matches the
          // type determined for the value of the let expression
          {
            constraintType: "type",
            constraint: [unknownTypeForRecursion, tyT1],
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
      for (const p of term.params) {
        paramsCtx.push(
          {
            name: p.name,
            type: (p.typeAnn || { tag: "TyId", name: genUniqTypeVar() }),
          },
        );
      }
      const newCtx = [...paramsCtx, ...ctx];
      const [tyT2, constr2] = recon(newCtx, term.body);
      return [
        {
          tag: "TyArrow",
          paramTypes: paramsCtx.map((e) => e.type),
          returnType: tyT2,
        },
        constr2,
      ];
    }
    case "TmApp": {
      // 1 - func
      // argTypes
      const [tyT1, constr1] = recon(ctx, term.func);

      let argTypes = [];
      let argConstraints = [];
      for (const arg of term.args) {
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
            tag: "TyArrow",
            paramTypes: argTypes,
            returnType: { tag: "TyId", name: tyIdSym },
          },
        ],
      };

      return [
        { tag: "TyId", name: tyIdSym },
        [newConstraint, ...constr1, ...argConstraints],
      ];
    }
    default:
      return assertNever(term);
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
      case "TyVoid":
        return tyS;
      case "TyRef":
        return {
          tag: "TyRef",
          valType: helper(tyS.valType),
        };
      case "TyList":
        return {
          tag: "TyList",
          elementType: helper(tyS.elementType),
        };
      case "TyRecord": {
        const substitutedFieldTypes: typeof tyS.rowExp.fieldTypes = {};
        for (
          const [fieldName, fieldType] of Object.entries(tyS.rowExp.fieldTypes)
        ) {
          substitutedFieldTypes[fieldName] = helper(fieldType);
        }
        return {
          tag: "TyRecord",
          rowExp: { name: tyS.rowExp.name, fieldTypes: substitutedFieldTypes },
        };
      }
      case "TyArrow":
        return {
          tag: "TyArrow",
          paramTypes: tyS.paramTypes.map((p) => helper(p)),
          returnType: helper(tyS.returnType),
        };
      case "TyId": {
        if (tyS.name === tyX) {
          return tyT;
        } else {
          return tyS;
        }
      }
      default:
        return assertNever(tyS);
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

function applySubst(constraints: Constraints, tyT: Type) {
  return constraints.reverse().reduce((tyS, constraint) => {
    if (constraint.constraintType !== "type") {
      // return constraint;
      const [pId, pC2] = constraint.constraint;
      // if (pId.row.name === 'emptyrow') throw new Error();
      // return substituteInRow(pId.row.name, pC2.row, tyS)
      throw new Error();
    }
    const [tyId, tyC2] = constraint.constraint;
    if (tyId.tag !== "TyId") throw new Error();
    return substituteInTy(tyId.name, tyC2, tyS);
  }, tyT);
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
        substituteInTy(tyX, tyT, tyS1),
        substituteInTy(tyX, tyT, tyS2),
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
        substituteInRow(pX, pR, pS1),
        substituteInRow(pX, pR, pS2),
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
      case "TyVoid":
        return false;
      case "TyRef":
        return helper(tyT.valType);
      case "TyList":
        return helper(tyT.elementType);
      case "TyRecord": {
        for (const [_, fieldType] of Object.entries(tyT.rowExp.fieldTypes)) {
          if (helper(fieldType)) {
            return true;
          }
        }
        return false;
      }
      case "TyArrow":
        return tyT.paramTypes.filter((p) => helper(p)).length > 0 ||
          helper(tyT.returnType);
      case "TyId":
        return tyT.name === tyX;
      default:
        return assertNever(tyT);
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
          tyS.tag === "TyId" && tyT.tag === "TyId" &&
          tyS.name === tyT.name
        ) {
          return helper(restConstraints);
        } else if (tyT.tag === "TyId") {
          if (occursIn(tyT.name, tyS)) {
            throw new Error(`circular constraints`);
          }
          return [
            ...helper(
              substituteInConstr(tyT.name, tyS, restConstraints),
            ),
            {
              constraintType: "type",
              constraint: [tyT, tyS],
            },
          ];
        } else if (tyS.tag === "TyId") {
          const flippedConstraint: Constraint = {
            constraintType: "type",
            constraint: [tyT, tyS],
          };
          return helper([flippedConstraint, ...restConstraints]);
        } else if (tyS.tag === tyT.tag) {
          switch (tyS.tag) {
            case "TyBool":
            case "TyInt":
            case "TyStr":
            case "TyVoid":
              return helper(restConstraints);
            case "TyRef": {
              if (tyT.tag !== "TyRef") throw new Error();
              const valConstraint: Constraints[0] = {
                constraintType: "type",
                constraint: [
                  tyS.valType,
                  tyT.valType,
                ],
              };
              return helper([valConstraint, ...restConstraints]);
            }
            case "TyList": {
              if (tyT.tag !== "TyList") throw new Error();
              const elementConstraint: Constraints[0] = {
                constraintType: "type",
                constraint: [
                  tyS.elementType,
                  tyT.elementType,
                ],
              };
              return helper([elementConstraint, ...restConstraints]);
            }
            case "TyRecord": {
              if (tyT.tag !== "TyRecord") throw new Error();
              const rowsConstraint: Constraint = {
                constraintType: "row",
                constraint: [tyS.rowExp, tyT.rowExp],
              };
              return helper([rowsConstraint, ...restConstraints]);
            }
            case "TyArrow": {
              if (tyT.tag !== "TyArrow") throw new Error();
              if (tyS.paramTypes.length !== tyT.paramTypes.length) {
                throw new Error(
                  `Unsolvable constraints: expected ${tyS.paramTypes.length} arguments but got ${tyT.paramTypes.length}`,
                );
              }
              const paramConstraints: Constraints = [];
              for (let i = 0; i < tyS.paramTypes.length; i++) {
                paramConstraints.push({
                  constraintType: "type",
                  constraint: [
                    tyS.paramTypes[i],
                    tyT.paramTypes[i],
                  ],
                });
              }
              const returnConstraint: Constraints[0] = {
                constraintType: "type",
                constraint: [
                  tyS.returnType,
                  tyT.returnType,
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
            default:
              return assertNever(tyS);
          }
        } else if (tyS.tag !== tyT.tag) {
          throw new TypeError(
            `Unsolvable constraints, expected type ${tyS.tag}, but got ${tyT.tag}`,
          );
        } else {
          throw new Error();
        }
      }
      case "row": {
        const [pR, pS] = constraints[0].constraint;
        const restConstraints = constraints.slice(1);
        if (
          pR.name !== "emptyrow" &&
          Object.entries(pR.fieldTypes).length === 0
        ) {
          if (occursInRow(pR.name, pS)) {
            throw new Error(`circular constraints`);
          }
          return [
            ...helper(
              substituteInRowConstr(pR.name, pS, restConstraints),
            ),
            { constraintType: "row", constraint: [pS, pR] },
          ];
        } else if (
          pS.name !== "emptyrow" &&
          Object.entries(pS.fieldTypes).length === 0
        ) {
          const flippedConstraint: Constraint = {
            constraintType: "row",
            constraint: [pS, pR],
          };
          return helper([flippedConstraint, ...restConstraints]);
        } else if (pR.name === "emptyrow" && pS.name === "emptyrow") {
          // fields must be _exactly_ the same
          // ...same length
          if (
            Object.entries(pR.fieldTypes).length !==
              Object.entries(pS.fieldTypes).length
          ) {
            throw new Error(
              `Expected ${
                Object.entries(pR.fieldTypes).length
              } fields but got ${Object.entries(pS.fieldTypes).length}`,
            );
          }
          // ...all fields in pR must be in pS
          for (const [fieldName, _] of Object.entries(pR.fieldTypes)) {
            if (!(fieldName in pS.fieldTypes)) {
              throw new Error(`Expected field ${fieldName}`);
            }
          }
          // ...all fields in pS must be in pR
          for (const [fieldName, _] of Object.entries(pS.fieldTypes)) {
            if (!(fieldName in pR.fieldTypes)) {
              throw new Error(`Expected field ${fieldName}`);
            }
          }

          const fieldConstraints: Constraints = [];
          for (const [fieldName, _] of Object.entries(pR.fieldTypes)) {
            fieldConstraints.push({
              constraintType: "type",
              constraint: [
                pR.fieldTypes[fieldName],
                pS.fieldTypes[fieldName],
              ],
            });
          }
          return helper([...fieldConstraints, ...restConstraints]);
        } else if (pR.name === "emptyrow") {
          // pS fieldTypes must be subset of pR fieldTypes
          if (
            Object.entries(pS.fieldTypes).length >
              Object.entries(pR.fieldTypes).length
          ) {
            throw new Error(
              `Unsolvable constraints, fields not a subset`,
            );
          }
          for (const [fieldName, _] of Object.entries(pS.fieldTypes)) {
            if (!(fieldName in pR.fieldTypes)) {
              throw new Error(`Expected field ${fieldName}`);
            }
          }

          const commonFieldConstraints: Constraints = [];
          for (const [fieldName, _] of Object.entries(pS.fieldTypes)) {
            commonFieldConstraints.push({
              constraintType: "type",
              constraint: [
                pR.fieldTypes[fieldName],
                pS.fieldTypes[fieldName],
              ],
            });
          }
          const constraintOnExtraFields: Constraint = {
            constraintType: "row",
            constraint: [
              { name: pS.name, fieldTypes: {} },
              {
                name: "emptyrow",
                fieldTypes: omit(pR.fieldTypes, Object.keys(pR.fieldTypes)),
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
        } else if (pS.name === "emptyrow") {
          const flippedConstraint: Constraint = {
            constraintType: "row",
            constraint: [pS, pR],
          };
          return helper([flippedConstraint, ...restConstraints]);
        } else {
          const commonFieldNames: string[] = [];
          for (const [fieldName, _] of Object.entries(pR.fieldTypes)) {
            if (fieldName in pS.fieldTypes) {
              commonFieldNames.push(fieldName);
            }
          }

          const commonFieldConstraints: Constraints = [];
          for (const fieldName of commonFieldNames) {
            commonFieldConstraints.push({
              constraintType: "type",
              constraint: [
                pR.fieldTypes[fieldName],
                pS.fieldTypes[fieldName],
              ],
            });
          }

          const freshRowVar = genUniqRowVar();
          const pRNew: RowExpression = {
            name: freshRowVar,
            fieldTypes: omit(pR.fieldTypes, commonFieldNames),
          };
          const pSNew: RowExpression = {
            name: freshRowVar,
            fieldTypes: omit(pS.fieldTypes, commonFieldNames),
          };
          if (occursInRow(pR.name, pRNew)) {
            throw new Error(`circular constraints`);
          }
          if (occursInRow(pS.name, pSNew)) {
            throw new Error(`circular constraints`);
          }

          return helper(
            substituteInRowConstr(
              pR.name,
              pRNew,
              substituteInRowConstr(pS.name, pSNew, [
                ...commonFieldConstraints,
                ...restConstraints,
              ]),
            ),
          );
        }
      }
      default:
        return assertNever(constraints[0]);
    }
  }
  return helper(constraints);
}
