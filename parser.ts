import { Lexer, SourceInfo } from "./lexer.ts";
import { ParseError, EOFError } from "./exceptions.ts";

export type Value =
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string }
  | { tag: "TmList"; elements: Term[] };

export type Term =
  & { info: SourceInfo }
  & {
    term: (
      | Value
      | { tag: "TmVar"; name: string }
      | { tag: "TmIf"; cond: Term; then: Term; else: Term }
      | { tag: "TmAbs"; params: { name: string }[]; body: Term }
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
      case "RBRACK":
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

      case "LBRACK": {
        const elements = [];
        while (true) {
          const next = lexer.peek();
          if (!next) {
            throw new Error();
          } else if (next.token.tag === "RBRACK") {
            const closeBrack_ = lexer.nextToken();
            if (closeBrack_ === null) {
              throw new Error("impossible");
            }
            return {
              info: {
                startIdx: cur.info.startIdx,
                endIdx: closeBrack_.info.endIdx,
              },
              term: { tag: "TmList", elements },
            };
          } else {
            elements.push(createAST(lexer));
          }
        }
      }

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new EOFError();
        switch (nextToken.token.tag) {
          case "RPAREN":
          case "LBRACK":
          case "RBRACK":
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
                params.push({ name: next.token.name });
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
