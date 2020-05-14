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

export type Lexer = { peek: () => Token | null; nextToken: () => Token | null };

export function createLexer(s: string): Lexer {
  let i = 0;
  let input = s.replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .split(/\s+/)
    .filter(Boolean);
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
