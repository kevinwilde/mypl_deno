import { Lexer } from "./lexer.ts";
import { assert } from "./utils.ts";
import { Type } from "./typechecker.ts";

export type Value =
  | { tag: "TmBool"; val: boolean }
  | { tag: "TmInt"; val: number }
  | { tag: "TmStr"; val: string };

export type Term =
  | Value
  | { tag: "TmVar"; name: string }
  | { tag: "TmIf"; cond: Term; then: Term; else: Term }
  | { tag: "TmAbs"; params: { name: string; typeAnn: Type }[]; body: Term }
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
      case "COLON":
      case "ARROW":
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
          case "COLON":
          case "ARROW":
          case "BOOL":
          case "INT":
          case "STR":
            throw new Error(`Unexpected token: ${nextToken.tag}`);
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
                const colon = lexer.nextToken();
                assert(colon !== null, "Unexpected EOF");
                assert(
                  colon?.tag === "COLON",
                  `Unexpected token: expected \`:\` but got ${colon?.tag}`,
                );
                const typeAnn = parseTypeAnn(lexer);
                params.push({ name: next.name, typeAnn });
              } else {
                throw new Error();
              }
            }
            const body = createAST(lexer);
            const closeLambdaParen = lexer.nextToken();
            assert(closeLambdaParen !== null, "Unexpected EOF");
            assert(
              closeLambdaParen?.tag === "RPAREN",
              `Unexpected token: expected \`)\` but got ${closeLambdaParen
                ?.tag}`,
            );
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
            assert(
              closeLetParen?.tag === "RPAREN",
              `Unexpected token: expected \`)\` but got ${closeLetParen?.tag}`,
            );
            return { tag: "TmLet", name: varName.name, val, body };
          }
          case "IF": {
            const if_ = lexer.nextToken();
            const cond = createAST(lexer);
            const then = createAST(lexer);
            const else_ = createAST(lexer);
            const closeIfParen = lexer.nextToken();
            assert(closeIfParen !== null, "Unexpected EOF");
            assert(
              closeIfParen?.tag === "RPAREN",
              `Unexpected token: expected \`)\` but got ${closeIfParen?.tag}`,
            );
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

function parseTypeAnn(lexer: Lexer): Type {
  const cur = lexer.nextToken();
  if (!cur) {
    throw new Error("Unexpected EOF");
  }
  switch (cur.tag) {
    case "RPAREN":
    case "COLON":
    case "ARROW":
    case "LET":
    case "IF":
    case "LAMBDA":
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
    case "LPAREN": {
      const paramTypes = [];
      while (lexer.peek() && lexer.peek()?.tag !== "RPAREN") {
        paramTypes.push(parseTypeAnn(lexer));
      }
      const rparen_ = lexer.nextToken();
      assert(rparen_ !== null, "Unexpected EOF");
      assert(
        rparen_?.tag === "RPAREN",
        `Unexpected token: expected \`)\` but got ${rparen_?.tag}`,
      );
      const arrow = lexer.nextToken();
      assert(arrow !== null, "Unexpected EOF");
      assert(
        arrow?.tag === "ARROW",
        `Unexpected token: expected \`->\` but got ${arrow?.tag}`,
      );
      const returnType = parseTypeAnn(lexer);
      return { tag: "TyArrow", paramTypes, returnType };
    }
    default: {
      const _exhaustiveCheck: never = cur;
      throw new Error();
    }
  }
}
