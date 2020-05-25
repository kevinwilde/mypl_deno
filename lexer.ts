type Token =
  | { tag: "LPAREN" }
  | { tag: "RPAREN" }
  | { tag: "LET" }
  | { tag: "IF" }
  | { tag: "LAMBDA" }
  | { tag: "BOOL"; val: boolean }
  | { tag: "INT"; val: number }
  | { tag: "STR"; val: string }
  | { tag: "IDEN"; name: string };

export type Lexer = { peek: () => Token | null; nextToken: () => Token | null };

export function createLexer(s: string): Lexer {
  let i = 0;
  const input = s.replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .match(/[^\s"]+|"([^"]*)"/g);
  if (!input) {
    throw new Error();
  }
  function charToToken(char: string): Token | null {
    if (!char) {
      return null;
    }
    switch (char) {
      case "(":
        return { tag: "LPAREN" };
      case ")":
        return { tag: "RPAREN" };
      case "let":
        return { tag: "LET" };
      case "if":
        return { tag: "IF" };
      case "lambda":
        return { tag: "LAMBDA" };
      case "#t":
        return { tag: "BOOL", val: true };
      case "#f":
        return { tag: "BOOL", val: false };
    }
    if (parseInt(char).toString() === char) {
      return { tag: "INT", val: parseInt(char) };
    }
    if (char[0] === '"' && char[char.length - 1] === '"') {
      return { tag: "STR", val: char.slice(1, char.length - 1) };
    }
    return { tag: "IDEN", name: char };
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
