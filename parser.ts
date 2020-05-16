import { Lexer } from "./lexer.ts";
import { assert } from "./utils.ts";

export type Value =
  | { type: "BOOL"; val: boolean }
  | { type: "INT"; val: number }
  | { type: "STR"; val: string };

export type Term =
  | Value
  | { type: "VAR"; name: string }
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
      case "BOOL":
        return { type: "BOOL", val: cur.val };
      case "INT":
        return { type: "INT", val: cur.val };
      case "STR":
        return { type: "STR", val: cur.val };
      case "VAR":
        return { type: "VAR", name: cur.name };

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new Error();
        switch (nextToken.type) {
          case "BOOL":
          case "INT":
          case "STR":
          case "RPAREN":
            throw new Error(`Unexpected token: ${cur.type}`);
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
            assert(closeLambdaParen !== null, "Unexpected EOF");
            assert(closeLambdaParen?.type === "RPAREN", "Unexpected token");
            return { type: "ABS", params, body };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            const varName = lexer.nextToken();
            if (varName === null || varName.type !== "VAR") {
              throw new Error(
                "Expected a variable name to bind let expression to",
              );
            }
            const val = createAST(lexer);
            const body = createAST(lexer);
            const closeLetParen = lexer.nextToken();
            assert(closeLetParen !== null, "Unexpected EOF");
            assert(closeLetParen?.type === "RPAREN", "Unexpected token");
            return {
              type: "APP",
              func: { type: "ABS", params: [varName.name], body },
              args: [val],
            };
          }
          case "IF": {
            const if_ = lexer.nextToken();
            const cond = createAST(lexer);
            const then = createAST(lexer);
            const else_ = createAST(lexer);
            const closeIfParen = lexer.nextToken();
            assert(closeIfParen !== null, "Unexpected EOF");
            assert(closeIfParen?.type === "RPAREN", "Unexpected token");
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
