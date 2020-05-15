import { Lexer } from "./lexer.ts";
import { assert } from "./utils.ts";

export type Value =
  | { type: "INT"; val: number }
  | { type: "BOOL"; val: boolean };

export type Term =
  | Value
  | { type: "VAR"; name: string }
  | { type: "LET"; name: string; val: Term; body: Term }
  | { type: "IF"; cond: Term; then: Term; else: Term }
  | { type: "ABS"; params: string[]; body: Term }
  | { type: "APP"; func: Term; args: Term[] };

export function createAST(lexer: Lexer): Term {
  function getNextTerm(): Term | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new Error("Unexpected EOF");
    }

    switch (cur.type) {
      case "RPAREN":
        throw new Error("Unexpected close paren");
      case "LET":
      case "IF":
      case "LAMBDA":
        throw new Error(`Unexpected token: ${cur.type}`);
      case "TRUE":
        return { type: "BOOL", val: true };
      case "FALSE":
        return { type: "BOOL", val: false };
      case "INT":
        return { type: "INT", val: cur.val };
      case "VAR":
        return { type: "VAR", name: cur.name };

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new Error();
        switch (nextToken.type) {
          case "TRUE":
            throw new Error();
          case "FALSE":
            throw new Error();
          case "INT":
            throw new Error();
          case "RPAREN":
            throw new Error();
          case "LAMBDA": {
            const lambda_ = lexer.nextToken();
            const params = [];
            const paramsOpenParen = lexer.nextToken();
            assert(
              paramsOpenParen !== null && paramsOpenParen.type === "LPAREN",
            );
            while (true) {
              const next = lexer.nextToken();
              if (!next) {
                throw new Error();
              } else if (next.type === "RPAREN") {
                break;
              } else if (next.type === "VAR") {
                params.push(next.name);
              } else {
                throw new Error();
              }
            }
            const body = createAST(lexer);
            const closeLambdaParen = lexer.nextToken();
            assert(
              closeLambdaParen !== null &&
                closeLambdaParen.type === "RPAREN",
            );
            return { type: "ABS", params, body };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            const name = lexer.nextToken();
            assert(name !== null && name.type === "VAR");
            const val = createAST(lexer);
            const body = createAST(lexer);
            const closeLetParen = lexer.nextToken();
            assert(closeLetParen !== null && closeLetParen.type === "RPAREN");
            return { type: "LET", name: (name as any).name, val, body };
          }
          case "IF": {
            const if_ = lexer.nextToken();
            const cond = createAST(lexer);
            const then = createAST(lexer);
            const else_ = createAST(lexer);
            const closeIfParen = lexer.nextToken();
            assert(closeIfParen !== null && closeIfParen.type === "RPAREN");
            return { type: "IF", cond, then, else: else_ };
          }
          case "LPAREN":
          case "VAR": {
            const func = createAST(lexer);
            const args = [];
            while (true) {
              const next = lexer.peek();
              if (next === null) {
                throw new Error();
              } else if (next.type === "RPAREN") {
                const throwAway_ = lexer.nextToken();
                break;
              } else {
                args.push(createAST(lexer));
              }
            }
            return { type: "APP", func, args };
          }
          default: {
            const _exhaustiveCheck: never = nextToken;
            throw new Error();
          }
        }
      }
      default: {
        const _exhaustiveCheck: never = cur;
        throw new Error();
      }
    }
  }

  const result = getNextTerm();
  if (!result) {
    throw new Error("bad program");
  }
  return result;
}
