import { Lexer } from "./lexer.ts";
import { assert } from "./utils.ts";

export type Value =
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string };

export type Term =
  | Value
  | { tag: "TmVar"; name: string }
  | { tag: "TmIf"; cond: Term; then: Term; else: Term }
  | { tag: "TmAbs"; params: { name: string }[]; body: Term }
  | { tag: "TmApp"; func: Term; args: Term[] }
  | { tag: "TmLet"; name: string; val: Term; body: Term };

export function createAST(lexer: Lexer): Term {
  function getNextTerm(): Term | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new Error("Unexpected EOF");
    }

    switch (cur.tag) {
      case "RPAREN":
      case "LET":
      case "IF":
      case "LAMBDA":
        throw new Error(`Unexpected token: ${cur.tag}`);
      case "BOOL":
        return { tag: "TmBool", val: cur.val };
      case "INT":
        return { tag: "TmInt", val: cur.val };
      case "STR":
        return { tag: "TmStr", val: cur.val };
      case "IDEN":
        return { tag: "TmVar", name: cur.name };

      case "LPAREN": {
        let nextToken = lexer.peek();
        if (!nextToken) throw new Error();
        switch (nextToken.tag) {
          case "RPAREN":
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
              } else if (next.tag === "IDEN") {
                params.push({ name: next.name });
              } else {
                throw new Error();
              }
            }
            const body = createAST(lexer);
            const closeLambdaParen = lexer.nextToken();
            assert(closeLambdaParen !== null, "Unexpected EOF");
            assert(closeLambdaParen?.tag === "RPAREN", "Unexpected token");
            return { tag: "TmAbs", params, body };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            const varName = lexer.nextToken();
            if (varName === null || varName.tag !== "IDEN") {
              throw new Error(
                "Expected a variable name to bind let expression to",
              );
            }
            const val = createAST(lexer);
            const body = createAST(lexer);
            const closeLetParen = lexer.nextToken();
            assert(closeLetParen !== null, "Unexpected EOF");
            assert(closeLetParen?.tag === "RPAREN", "Unexpected token");
            return { tag: "TmLet", name: varName.name, val, body };
          }
          case "IF": {
            const if_ = lexer.nextToken();
            const cond = createAST(lexer);
            const then = createAST(lexer);
            const else_ = createAST(lexer);
            const closeIfParen = lexer.nextToken();
            assert(closeIfParen !== null, "Unexpected EOF");
            assert(closeIfParen?.tag === "RPAREN", "Unexpected token");
            return { tag: "TmIf", cond, then, else: else_ };
          }
          case "LPAREN":
          case "IDEN": {
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
            return { tag: "TmApp", func, args };
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
