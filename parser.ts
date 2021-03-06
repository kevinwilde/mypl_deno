import { Lexer, SourceInfo } from "./lexer.ts";
import { TypeWithInfo } from "./typechecker.ts";
import { ParseError, EOFError } from "./exceptions.ts";
import { assertNever } from "./utils.ts";

type Term = (
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string }
  | { tag: "TmEmpty" }
  | { tag: "TmCons"; car: TermWithInfo; cdr: TermWithInfo }
  | { tag: "TmRecord"; fields: Record<string, TermWithInfo> }
  | { tag: "TmProj"; record: TermWithInfo; fieldName: string } // record should be TmRecord when well-formed
  | { tag: "TmVar"; name: string }
  | { tag: "TmRef"; val: TermWithInfo }
  | {
    tag: "TmIf";
    cond: TermWithInfo;
    then: TermWithInfo;
    else: TermWithInfo;
  }
  | {
    tag: "TmAbs";
    params: { name: string; typeAnn: TypeWithInfo | null }[];
    body: TermWithInfo;
  }
  | { tag: "TmApp"; func: TermWithInfo; args: TermWithInfo[] }
  | { tag: "TmLet"; name: string; val: TermWithInfo; body: TermWithInfo }
);

export type TermWithInfo = {
  info: SourceInfo;
  term: Term;
};

export function createAST(lexer: Lexer): TermWithInfo {
  function getNextTerm(): TermWithInfo | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new EOFError();
    }

    switch (cur.token.tag) {
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
        throw new ParseError(`Unexpected token: ${cur.token.tag}`, cur.info);
      case "EMPTY":
        return { info: cur.info, term: { tag: "TmEmpty" } };
      case "BOOL":
        return { info: cur.info, term: { tag: "TmBool", val: cur.token.val } };
      case "INT":
        return { info: cur.info, term: { tag: "TmInt", val: cur.token.val } };
      case "STR":
        return { info: cur.info, term: { tag: "TmStr", val: cur.token.val } };
      case "IDEN": {
        return { info: cur.info, term: { tag: "TmVar", name: cur.token.name } };
      }
      case "LCURLY": {
        const fields: Record<string, TermWithInfo> = {};
        while (true) {
          const next = lexer.nextToken();
          if (!next) {
            throw new EOFError();
          } else if (next.token.tag === "RCURLY") {
            return {
              info: { startIdx: cur.info.startIdx, endIdx: next.info.endIdx },
              term: { tag: "TmRecord", fields },
            };
          } else if (next.token.tag === "IDEN") {
            const colon = lexer.nextToken();
            if (colon === null) throw new EOFError();
            if (colon.token.tag !== "COLON") {
              throw new ParseError(
                `Unexpected token: expected \`:\` but got ${colon.token.tag}`,
                colon.info,
              );
            }
            fields[next.token.name] = createAST(lexer);
          } else {
            throw new ParseError("Unexpected token", next.info);
          }
        }
      }

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new EOFError();
        switch (nextToken.token.tag) {
          case "RPAREN":
          case "LCURLY":
          case "RCURLY":
          case "COLON":
          case "ARROW":
          case "EMPTY":
          case "BOOL":
          case "INT":
          case "STR":
            throw new ParseError(
              `Unexpected token: ${nextToken.token.tag}`,
              nextToken.info,
            );
          case "LAMBDA": {
            const lambda_ = lexer.nextToken();
            const params = [];
            const paramsOpenParen = lexer.nextToken();
            if (paramsOpenParen === null) {
              throw new EOFError();
            }
            if (paramsOpenParen.token.tag !== "LPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`(\` but got ${paramsOpenParen.token.tag}`,
                paramsOpenParen.info,
              );
            }
            while (true) {
              const next = lexer.nextToken();
              if (!next) {
                throw new EOFError();
              } else if (next.token.tag === "RPAREN") {
                break;
              } else if (next.token.tag === "IDEN") {
                let typeAnn: TypeWithInfo | null = null;
                if (lexer.peek() && lexer.peek()?.token.tag === "COLON") {
                  const colon = lexer.nextToken();
                  if (colon === null || colon.token.tag !== "COLON") {
                    throw new Error();
                  }
                  typeAnn = parseTypeAnn(lexer);
                }
                params.push({ name: next.token.name, typeAnn });
              } else {
                throw new ParseError(
                  `Unexpected token: ${next.token.tag}`,
                  next.info,
                );
              }
            }
            const body = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: { tag: "TmAbs", params, body },
            };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            if (let_ === null) {
              throw new EOFError();
            }
            const varName = lexer.nextToken();
            if (varName === null) {
              throw new EOFError();
            }
            if (varName.token.tag !== "IDEN") {
              throw new ParseError(
                "Unexpected token: Expected a variable name to bind let expression to",
                varName.info,
              );
            }
            const val = createAST(lexer);
            const body = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }

            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: { tag: "TmLet", name: varName.token.name, val, body },
            };
          }
          case "IF": {
            const if_ = lexer.nextToken();
            const cond = createAST(lexer);
            const then = createAST(lexer);
            const else_ = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: { tag: "TmIf", cond, then, else: else_ },
            };
          }
          case "AND": {
            const and_ = lexer.nextToken();
            const cond1 = createAST(lexer);
            const cond2 = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: {
                tag: "TmIf",
                cond: cond1,
                then: cond2,
                else: cond1,
              },
            };
          }
          case "OR": {
            const and_ = lexer.nextToken();
            const cond1 = createAST(lexer);
            const cond2 = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: {
                tag: "TmIf",
                cond: cond1,
                then: cond1,
                else: cond2,
              },
            };
          }
          case "REF": {
            const ref_ = lexer.nextToken();
            const refVal = createAST(lexer);
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: { tag: "TmRef", val: refVal },
            };
          }
          case "PROJ": {
            const getField_ = lexer.nextToken();
            const record = createAST(lexer);
            const fieldName = lexer.nextToken();
            if (fieldName === null) {
              throw new EOFError();
            }
            // Field name must be string literal for records
            if (fieldName.token.tag !== "STR") {
              throw new ParseError(
                `Unexpected token: expected field name but got ${fieldName.token.tag}`,
                fieldName.info,
              );
            }
            const closeParen = lexer.nextToken();
            if (closeParen === null) {
              throw new EOFError();
            }
            if (closeParen.token.tag !== "RPAREN") {
              throw new ParseError(
                `Unexpected token: expected \`)\` but got ${closeParen.token.tag}`,
                closeParen.info,
              );
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeParen.info.endIdx,
              },
              term: {
                tag: "TmProj",
                record,
                fieldName: fieldName.token.val,
              },
            };
          }
          case "LPAREN":
          case "IDEN": {
            const func = createAST(lexer);
            const args = [];
            while (true) {
              const next = lexer.peek();
              if (next === null) {
                throw new EOFError();
              } else if (next.token.tag === "RPAREN") {
                let closeParen_ = lexer.nextToken();
                return {
                  info: {
                    startIdx: cur.info.startIdx,
                    endIdx: next.info.endIdx,
                  },
                  term: { tag: "TmApp", func, args },
                };
              } else {
                args.push(createAST(lexer));
              }
            }
          }
          default:
            return assertNever(nextToken.token);
        }
      }
      default:
        return assertNever(cur.token);
    }
  }

  const result = getNextTerm();
  if (!result) {
    throw new EOFError();
  }
  return result;
}

function parseTypeAnn(lexer: Lexer): TypeWithInfo {
  const cur = lexer.nextToken();
  if (!cur) {
    throw new EOFError();
  }
  switch (cur.token.tag) {
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
      throw new ParseError(`Unexpected token: ${cur.token.tag}`, cur.info);
    case "IDEN": {
      switch (cur.token.name) {
        case "bool":
          return { info: cur.info, type: { tag: "TyBool" } };
        case "int":
          return { info: cur.info, type: { tag: "TyInt" } };
        case "str":
          return { info: cur.info, type: { tag: "TyStr" } };
        default:
          throw new ParseError(`Unknown type: ${cur.token.name}`, cur.info);
      }
    }
    case "LCURLY": {
      const fieldTypes: Record<string, TypeWithInfo> = {};
      while (true) {
        const next = lexer.nextToken();
        if (!next) {
          throw new EOFError();
        } else if (next.token.tag === "RCURLY") {
          return {
            info: { startIdx: cur.info.startIdx, endIdx: next.info.endIdx },
            type: {
              tag: "TyRecord",
              rowExp: { name: "emptyrow", fieldTypes },
            },
          };
        } else if (next.token.tag === "IDEN") {
          const fieldName = next.token.name;
          const colon = lexer.nextToken();
          if (colon === null) {
            throw new EOFError();
          }
          if (colon.token.tag !== "COLON") {
            throw new ParseError(
              `Unexpected token: expected \`:\` but got ${colon.token.tag}`,
              colon.info,
            );
          }
          fieldTypes[fieldName] = parseTypeAnn(lexer);
        } else {
          throw new ParseError(
            `Unexpected token: ${next.token.tag}`,
            next.info,
          );
        }
      }
    }
    case "LPAREN": {
      const next = lexer.nextToken();
      if (next === null) {
        throw new EOFError();
      } else if (next.token.tag === "REF") {
        const valType = parseTypeAnn(lexer);

        const rparen_ = lexer.nextToken();
        if (rparen_ === null) {
          throw new EOFError();
        }
        if (rparen_.token.tag !== "RPAREN") {
          throw new ParseError(
            `Unexpected token: expected \`)\` but got ${rparen_.token.tag}`,
            rparen_.info,
          );
        }

        return {
          info: { startIdx: cur.info.startIdx, endIdx: rparen_.info.endIdx },
          type: { tag: "TyRef", valType },
        };
      } else if (next.token.tag === "IDEN" && next.token.name === "Listof") {
        const elementType = parseTypeAnn(lexer);

        const rparen_ = lexer.nextToken();
        if (rparen_ === null) {
          throw new EOFError();
        }
        if (rparen_.token.tag !== "RPAREN") {
          throw new ParseError(
            `Unexpected token: expected \`)\` but got ${rparen_.token.tag}`,
            rparen_.info,
          );
        }

        return {
          info: { startIdx: cur.info.startIdx, endIdx: rparen_.info.endIdx },
          type: { tag: "TyList", elementType },
        };
      } else if (next.token.tag === "ARROW") {
        const funcTypes = [];
        while (lexer.peek() && lexer.peek()?.token.tag !== "RPAREN") {
          funcTypes.push(parseTypeAnn(lexer));
        }
        const rparen_ = lexer.nextToken();
        if (rparen_ === null) {
          throw new EOFError();
        }
        if (rparen_.token.tag !== "RPAREN") {
          throw new ParseError(
            `Unexpected token: expected \`)\` but got ${rparen_.token.tag}`,
            rparen_.info,
          );
        }
        if (funcTypes.length === 0) {
          throw new ParseError(
            `Unexpected token: expected function return type but got \`)\``,
            rparen_.info,
          );
        }

        const paramTypes = funcTypes.slice(0, funcTypes.length - 1);
        const returnType = funcTypes[funcTypes.length - 1];

        return {
          info: { startIdx: cur.info.startIdx, endIdx: rparen_.info.endIdx },
          type: { tag: "TyArrow", paramTypes, returnType },
        };
      } else {
        throw new ParseError(
          `Unexpected token: ${next.token.tag}`,
          next.info,
        );
      }
    }
    default:
      return assertNever(cur.token);
  }
}
