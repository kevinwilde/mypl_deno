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
  | { type: "ABS"; param: string; body: Term }
  | { type: "APP"; func: Term; arg: Term };

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
            const param = lexer.nextToken();
            assert(param !== null && param.type === "VAR");
            const body = createAST(lexer);
            return { type: "ABS", param: (param as any).name, body: body! };
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
            const arg = createAST(lexer);
            return { type: "APP", func, arg };
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

let lexer;
// lexer = createLexer("(let x 1)");
// prettyPrint(createTokenTree(lexer));
// lexer = createLexer(" (let y (lambda x (+ x 1)))");
// prettyPrint(createTokenTree(lexer));
// lexer = createLexer("((lambda x (+ x 1)) 3)");
// prettyPrint(createTokenTree(lexer));

lexer = createLexer("(let x 1)");
// console.log(collectAllTokens(lexer));
prettyPrint(createAST(lexer));
lexer = createLexer("  (let y (lambda x (succ x)))");
// console.log(collectAllTokens(lexer));
prettyPrint(createAST(lexer));

function prettyPrint(obj: any) {
  console.log(JSON.stringify(obj, null, 2));
}
