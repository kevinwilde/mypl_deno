import { Lexer } from "./lexer.ts";
import { Type } from "./typechecker.ts";
import { assertNever } from "./utils.ts";

export type Term = (
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string }
  | { tag: "TmEmpty" }
  | { tag: "TmCons"; car: Term; cdr: Term }
  | { tag: "TmRecord"; fields: Record<string, Term> }
  | { tag: "TmProj"; record: Term; fieldName: string } // record should be TmRecord when well-formed
  | { tag: "TmVar"; name: string }
  | { tag: "TmRef"; val: Term }
  | {
    tag: "TmIf";
    cond: Term;
    then: Term;
    else: Term;
  }
  | {
    tag: "TmAbs";
    params: { name: string; typeAnn: Type | null }[];
    body: Term;
  }
  | { tag: "TmApp"; func: Term; args: Term[] }
  | { tag: "TmLet"; name: string; val: Term; body: Term }
);

export function createAST(lexer: Lexer): Term {
  function getNextTerm(): Term | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new Error("eof");
    }

    switch (cur.tag) {
      case "RPAREN":
      case "RCURLY":
      case "COLON":
      case "ARROW":
      case "LET":
      case "IF":
      case "AND":
      case "OR":
      case "REF":
      case "PROJ":
      case "LAMBDA":
        throw new Error(`Unexpected token: ${cur.tag}`);
      case "EMPTY":
        return { tag: "TmEmpty" };
      case "BOOL":
        return { tag: "TmBool", val: cur.val };
      case "INT":
        return { tag: "TmInt", val: cur.val };
      case "STR":
        return { tag: "TmStr", val: cur.val };
      case "IDEN": {
        return { tag: "TmVar", name: cur.name };
      }
      case "LCURLY": {
        const fields: Record<string, Term> = {};
        while (true) {
          const next = lexer.nextToken();
          if (!next) {
            throw new Error("eof");
          } else if (next.tag === "RCURLY") {
            return { tag: "TmRecord", fields };
          } else if (next.tag === "IDEN") {
            const colon = lexer.nextToken();
            if (colon === null) throw new Error("eof");
            if (colon.tag !== "COLON") {
              throw new Error(
                `Unexpected token: expected \`:\` but got ${colon.tag}`,
              );
            }
            fields[next.name] = createAST(lexer);
          } else {
            throw new Error("Unexpected token");
          }
        }
      }

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new Error("eof");
        switch (nextToken.tag) {
          case "RPAREN":
          case "LCURLY":
          case "RCURLY":
          case "COLON":
          case "ARROW":
          case "EMPTY":
          case "BOOL":
          case "INT":
          case "STR":
            throw new Error(
              `Unexpected token: ${nextToken.tag}`,
            );
          case "LAMBDA": {
            const lambda_ = lexer.nextToken();
            const params = [];
            const paramsOpenParen = lexer.nextToken();
            if (paramsOpenParen === null) {
              throw new Error("eof");
            }
            if (paramsOpenParen.tag !== "LPAREN") {
              throw new Error(
                `Unexpected token: expected \`(\` but got ${paramsOpenParen.tag}`,
              );
            }
            while (true) {
              const next = lexer.nextToken();
              if (!next) {
                throw new Error("eof");
              } else if (next.tag === "RPAREN") {
                break;
              } else if (next.tag === "IDEN") {
                let typeAnn: Type | null = null;
                if (lexer.peek() && lexer.peek()?.tag === "COLON") {
                  const colon = lexer.nextToken();
                  if (colon === null || colon.tag !== "COLON") {
                    throw new Error();
                  }
                  typeAnn = parseTypeAnn(lexer);
                }
                params.push({ name: next.name, typeAnn });
              } else {
                throw new Error(
                  `Unexpected token: ${next.tag}`,
                );
              }
            }
            const body = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }
            return { tag: "TmAbs", params, body };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            if (let_ === null) {
              throw new Error("eof");
            }
            const varName = lexer.nextToken();
            if (varName === null) {
              throw new Error("eof");
            }
            if (varName.tag !== "IDEN") {
              throw new Error(
                "Unexpected token: Expected a variable name to bind let expression to",
              );
            }
            const val = createAST(lexer);
            const body = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }

            return { tag: "TmLet", name: varName.name, val, body };
          }
          case "IF": {
            const if_ = lexer.nextToken();
            const cond = createAST(lexer);
            const then = createAST(lexer);
            const else_ = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }
            return { tag: "TmIf", cond, then, else: else_ };
          }
          case "AND": {
            const and_ = lexer.nextToken();
            const cond1 = createAST(lexer);
            const cond2 = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }
            return {
              tag: "TmIf",
              cond: cond1,
              then: cond2,
              else: cond1,
            };
          }
          case "OR": {
            const and_ = lexer.nextToken();
            const cond1 = createAST(lexer);
            const cond2 = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }
            return {
              tag: "TmIf",
              cond: cond1,
              then: cond1,
              else: cond2,
            };
          }
          case "REF": {
            const ref_ = lexer.nextToken();
            const refVal = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }
            return { tag: "TmRef", val: refVal };
          }
          case "PROJ": {
            const getField_ = lexer.nextToken();
            const record = createAST(lexer);
            const fieldName = lexer.nextToken();
            if (fieldName === null) {
              throw new Error("eof");
            }
            // Field name must be string literal for records
            if (fieldName.tag !== "STR") {
              throw new Error(
                `Unexpected token: expected field name but got ${fieldName.tag}`,
              );
            }
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new Error("eof");
            }
            if (closeParen.tag !== "RPAREN") {
              throw new Error(
                `Unexpected token: expected \`)\` but got ${closeParen.tag}`,
              );
            }
            return {
              tag: "TmProj",
              record,
              fieldName: fieldName.val,
            };
          }
          case "LPAREN":
          case "IDEN": {
            const func = createAST(lexer);
            const args = [];
            while (true) {
              const next = lexer.peek();
              if (next === null) {
                throw new Error("eof");
              } else if (next.tag === "RPAREN") {
                let closeParen_ = lexer.nextToken();
                return { tag: "TmApp", func, args };
              } else {
                args.push(createAST(lexer));
              }
            }
          }
          default:
            return assertNever(nextToken);
        }
      }
      default:
        return assertNever(cur);
    }
  }

  const result = getNextTerm();
  if (!result) {
    throw new Error("eof");
  }
  return result;
}

function parseTypeAnn(lexer: Lexer): Type {
  const cur = lexer.nextToken();
  if (!cur) {
    throw new Error("eof");
  }
  switch (cur.tag) {
    case "RPAREN":
    case "RCURLY":
    case "COLON":
    case "ARROW":
    case "LET":
    case "IF":
    case "AND":
    case "OR":
    case "LAMBDA":
    case "REF":
    case "PROJ":
    case "EMPTY":
    case "INT":
    case "BOOL":
    case "STR":
      throw new Error(`Unexpected token: ${cur.tag}`);
    case "IDEN": {
      switch (cur.name) {
        case "bool":
          return { tag: "TyBool" };
        case "int":
          return { tag: "TyInt" };
        case "str":
          return { tag: "TyStr" };
        default:
          throw new Error(`Unknown type: ${cur.name}`);
      }
    }
    case "LCURLY": {
      const fieldTypes: Record<string, Type> = {};
      while (true) {
        const next = lexer.nextToken();
        if (!next) {
          throw new Error("eof");
        } else if (next.tag === "RCURLY") {
          return {
            tag: "TyRecord",
            rowExp: { name: "emptyrow", fieldTypes },
          };
        } else if (next.tag === "IDEN") {
          const fieldName = next.name;
          const colon = lexer.nextToken();
          if (colon === null) {
            throw new Error("eof");
          }
          if (colon.tag !== "COLON") {
            throw new Error(
              `Unexpected token: expected \`:\` but got ${colon.tag}`,
            );
          }
          fieldTypes[fieldName] = parseTypeAnn(lexer);
        } else {
          throw new Error(
            `Unexpected token: ${next.tag}`,
          );
        }
      }
    }
    case "LPAREN": {
      const next = lexer.nextToken();
      if (next === null) {
        throw new Error("eof");
      } else if (next.tag === "REF") {
        const valType = parseTypeAnn(lexer);
        const rparen_ = lexer.nextToken();
        if (rparen_ === null) {
          throw new Error("eof");
        }
        if (rparen_.tag !== "RPAREN") {
          throw new Error(
            `Unexpected token: expected \`)\` but got ${rparen_.tag}`,
          );
        }
        return { tag: "TyRef", valType };
      } else if (next.tag === "IDEN" && next.name === "Listof") {
        const elementType = parseTypeAnn(lexer);
        const rparen_ = lexer.nextToken();
        if (rparen_ === null) {
          throw new Error("eof");
        }
        if (rparen_.tag !== "RPAREN") {
          throw new Error(
            `Unexpected token: expected \`)\` but got ${rparen_.tag}`,
          );
        }
        return { tag: "TyList", elementType };
      } else if (next.tag === "ARROW") {
        const funcTypes = [];
        while (lexer.peek() && lexer.peek()?.tag !== "RPAREN") {
          funcTypes.push(parseTypeAnn(lexer));
        }
        const rparen_ = lexer.nextToken();
        if (rparen_ === null) {
          throw new Error("eof");
        }
        if (rparen_.tag !== "RPAREN") {
          throw new Error(
            `Unexpected token: expected \`)\` but got ${rparen_.tag}`,
          );
        }
        if (funcTypes.length === 0) {
          throw new Error(
            `Unexpected token: expected function return type but got \`)\``,
          );
        }
        const paramTypes = funcTypes.slice(0, funcTypes.length - 1);
        const returnType = funcTypes[funcTypes.length - 1];
        return { tag: "TyArrow", paramTypes, returnType };
      } else {
        throw new Error(
          `Unexpected token: ${next.tag}`,
        );
      }
    }
    default:
      return assertNever(cur);
  }
}
