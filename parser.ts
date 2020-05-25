import { Lexer, SourceInfo } from "./lexer.ts";
import { Type } from "./typechecker.ts";
import { ParseError, EOFError } from "./exceptions.ts";

export type Value =
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string };

export type Term =
  & { info: SourceInfo }
  & {
    term: (
      | Value
      | { tag: "TmVar"; name: string }
      | { tag: "TmIf"; cond: Term; then: Term; else: Term }
      | { tag: "TmAbs"; params: { name: string; typeAnn: Type }[]; body: Term }
      | { tag: "TmApp"; func: Term; args: Term[] }
      | { tag: "TmLet"; name: string; val: Term; body: Term }
    );
  };

export function createAST(lexer: Lexer): Term {
  function getNextTerm(): Term | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new EOFError();
    }

    switch (cur.token.tag) {
      case "RPAREN":
      case "COLON":
      case "ARROW":
      case "LET":
      case "IF":
      case "LAMBDA":
        throw new ParseError(`Unexpected token: ${cur.token.tag}`, cur.info);
      case "BOOL":
        return { info: cur.info, term: { tag: "TmBool", val: cur.token.val } };
      case "INT":
        return { info: cur.info, term: { tag: "TmInt", val: cur.token.val } };
      case "STR":
        return { info: cur.info, term: { tag: "TmStr", val: cur.token.val } };
      case "IDEN":
        return { info: cur.info, term: { tag: "TmVar", name: cur.token.name } };

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new EOFError();
        switch (nextToken.token.tag) {
          case "RPAREN":
          case "COLON":
          case "ARROW":
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
                const colon = lexer.nextToken();
                if (colon === null) {
                  throw new EOFError();
                }
                if (
                  colon.token.tag !== "COLON"
                ) {
                  throw new ParseError(
                    `Unexpected token: expected \`:\` but got ${colon.token.tag}`,
                    colon.info,
                  );
                }
                const typeAnn = parseTypeAnn(lexer);
                params.push({ name: next.token.name, typeAnn });
              } else {
                throw new ParseError("Unexpected token", next.info);
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
          default: {
            const _exhaustiveCheck: never = nextToken.token;
            throw new Error();
          }
        }
      }
      default: {
        const _exhaustiveCheck: never = cur.token;
        throw new Error();
      }
    }
  }

  const result = getNextTerm();
  if (!result) {
    throw new EOFError();
  }
  return result;
}

function parseTypeAnn(lexer: Lexer): Type {
  const cur = lexer.nextToken();
  if (!cur) {
    throw new EOFError();
  }
  switch (cur.token.tag) {
    case "RPAREN":
    case "COLON":
    case "ARROW":
    case "LET":
    case "IF":
    case "LAMBDA":
    case "INT":
    case "BOOL":
    case "STR":
      throw new ParseError(`Unexpected token: ${cur.token.tag}`, cur.info);
    case "IDEN": {
      switch (cur.token.name) {
        case "bool":
          return { tag: "TyBool" };
        case "int":
          return { tag: "TyInt" };
        case "str":
          return { tag: "TyStr" };
        default:
          throw new ParseError(`Unknown type: ${cur.token.name}`, cur.info);
      }
    }
    case "LPAREN": {
      const arrow = lexer.nextToken();
      if (arrow === null) {
        throw new EOFError();
      }
      if (arrow.token.tag !== "ARROW") {
        throw new ParseError(
          `Unexpected token: expected \`->\` but got ${arrow.token.tag}`,
          arrow.info,
        );
      }

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
      const paramTypes = [];
      while (lexer.peek() && lexer.peek()?.token.tag !== "RPAREN") {
        paramTypes.push(parseTypeAnn(lexer));
      }
      const paramsCloseParen = lexer.nextToken();
      if (paramsCloseParen === null) {
        throw new EOFError();
      }
      if (paramsCloseParen.token.tag !== "RPAREN") {
        throw new ParseError(
          `Unexpected token: expected \`)\` but got ${paramsCloseParen.token.tag}`,
          paramsCloseParen.info,
        );
      }

      const returnType = parseTypeAnn(lexer);

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

      return { tag: "TyArrow", paramTypes, returnType };
    }
    default: {
      const _exhaustiveCheck: never = cur.token;
      throw new Error();
    }
  }
}
