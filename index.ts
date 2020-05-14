type Token =
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "LET" }
  | { type: "LAMBDA" }
  | { type: "TRUE" }
  | { type: "FALSE" }
  | { type: "INT"; val: number }
  //   | { type: "STR"; val: string }
  | { type: "VAR"; name: string };

type Lexer = { peek: () => Token | null; nextToken: () => Token | null };
function createLexer(s: string): Lexer {
  let i = 0;
  let input = s.replace(/\(/g, " ( ").replace(/\)/g, " ) ").split(/\s+/).filter(
    Boolean,
  );
  function charToToken(char: string): Token | null {
    if (!char) {
      return null;
    }
    switch (char) {
      case "(":
        return { type: "LPAREN" };
      case ")":
        return { type: "RPAREN" };
      case "let":
        return { type: "LET" };
      case "lambda":
        return { type: "LAMBDA" };
      case "#t":
        return { type: "TRUE" };
      case "#f":
        return { type: "FALSE" };
    }
    if (parseInt(char).toString() === char) {
      return { type: "INT", val: parseInt(char) };
    }
    //   if (cur[0] === '"' && cur[cur.length - 1] === '"') {
    //     return { type: "STR", val: cur };
    //   }
    return { type: "VAR", name: char };
  }
  return {
    peek: () => {
      return charToToken(input[i]);
    },
    nextToken: () => {
      const result = charToToken(input[i]);
      i++;
      return result;
    },
  };
}

type Term =
  | { type: "VAR"; name: string }
  | { type: "INT"; val: number }
  | { type: "BOOL"; val: boolean }
  | { type: "LET"; name: string; val: Term }
  | { type: "ABS"; params: string[]; body: Term }
  | { type: "APP"; func: Term; args: Term[] };

function createAST(lexer: Lexer): Term {
  function getNextTerm(): Term | null {
    const cur = lexer.nextToken();
    if (!cur) {
      throw new Error("Unexpected EOF");
    }

    switch (cur.type) {
      case "RPAREN":
        return null;
      case "LET":
        throw new Error();
      case "LAMBDA":
        throw new Error();
      case "TRUE":
        return { type: "BOOL", val: true };
      case "FALSE":
        return { type: "BOOL", val: false };
      case "INT":
        return { type: "INT", val: (cur as any).val };
      case "VAR":
        return { type: "VAR", name: (cur as any).name };

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
            return { type: "ABS", params, body: body! };
          }
          case "LET": {
            const let_ = lexer.nextToken();
            const name = lexer.nextToken();
            assert(name !== null && name.type === "VAR");
            const val = createAST(lexer);
            return { type: "LET", name: (name as any).name, val: val! };
          }
          case "LPAREN":
          case "VAR": {
            const func = createAST(lexer);
            const args = [];
            while (true) {
              const next = lexer.peek()
              if (next === null) {
                throw new Error()
              } else if (next.type === "RPAREN") {
                break
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

function assert(cond: boolean, msg = ""): asserts cond is true {
  if (!cond) {
    throw new Error(`AssertionFailed: ${msg}`);
  }
}

/// Test
let lexer;

lexer = createLexer("(let x 1)");
prettyPrint(createAST(lexer));

lexer = createLexer("  (let y (lambda (x) (succ x)))");
prettyPrint(createAST(lexer));

lexer = createLexer("  (let y (lambda (x) (+ 1 x)))");
prettyPrint(createAST(lexer));

lexer = createLexer("  (let y (lambda (x z) (+ z x)))");
prettyPrint(createAST(lexer));

function prettyPrint(obj: any) {
  console.log(JSON.stringify(obj, null, 2));
}
