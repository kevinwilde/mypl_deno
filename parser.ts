import { Lexer } from "./lexer.ts";
import { assert } from "./utils.ts";

export type Value =
  | { tag: "BOOL"; val: boolean }
  | { tag: "INT"; val: number }
  | { tag: "STR"; val: string };

export type Term =
  | Value
  | { tag: "VAR"; name: string }
  | { tag: "IF"; cond: Term; then: Term; else: Term }
  | { tag: "ABS"; params: string[]; body: Term }
  | { tag: "APP"; func: Term; args: Term[] };

export function createAST(lexer: Lexer): Term {
  function getNextTerm(): Term | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new Error("Unexpected EOF");
    }

    switch (cur.tag) {
      case "RPAREN":
        throw new Error("Unexpected close paren");
      case "LET":
      case "IF":
      case "LAMBDA":
        throw new Error(`Unexpected token: ${cur.tag}`);
      case "BOOL":
        return { tag: "BOOL", val: cur.val };
      case "INT":
        return { tag: "INT", val: cur.val };
      case "STR":
        return { tag: "STR", val: cur.val };
      case "VAR":
        return { tag: "VAR", name: cur.name };

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new Error();
        switch (nextToken.tag) {
          case "BOOL":
          case "INT":
          case "STR":
          case "RPAREN":
            throw new Error(`Unexpected token: ${cur.tag}`);
          case "LAMBDA": {
            const lambda_ = lexer.nextToken();
            const params = [];
            const paramsOpenParen = lexer.nextToken();
            assert(
              paramsOpenParen !== null && paramsOpenParen.tag === "LPAREN",
            );
            while (true) {
              const next = lexer.nextToken();
              if (!next) {
                throw new Error();
              } else if (next.tag === "RPAREN") {
                break;
              } else if (next.tag === "VAR") {
                params.push(next.name);
              } else {
                throw new Error();
              }
            }
            const body = createAST(lexer);
            const closeLambdaParen = lexer.nextToken();
            assert(closeLambdaParen !== null, "Unexpected EOF");
            assert(closeLambdaParen?.tag === "RPAREN", "Unexpected token");
            return { tag: "ABS", params, body };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            const varName = lexer.nextToken();
            if (varName === null || varName.tag !== "VAR") {
              throw new Error(
                "Expected a variable name to bind let expression to",
              );
            }
            const val = createAST(lexer);
            const body = createAST(lexer);
            const closeLetParen = lexer.nextToken();
            assert(closeLetParen !== null, "Unexpected EOF");
            assert(closeLetParen?.tag === "RPAREN", "Unexpected token");
            return {
              tag: "APP",
              func: { tag: "ABS", params: [varName.name], body },
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
            assert(closeIfParen?.tag === "RPAREN", "Unexpected token");
            return { tag: "IF", cond, then, else: else_ };
          }
          case "LPAREN":
          case "VAR": {
            const func = createAST(lexer);
            const args = [];
            while (true) {
              const next = lexer.peek();
              if (next === null) {
                throw new Error();
              } else if (next.tag === "RPAREN") {
                const throwAway_ = lexer.nextToken();
                break;
              } else {
                args.push(createAST(lexer));
              }
            }
            return { tag: "APP", func, args };
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
