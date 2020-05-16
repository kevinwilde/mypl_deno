type Token =
  | { type: "LPAREN" }
  | { type: "RPAREN" }
  | { type: "LET" }
  | { type: "IF" }
  | { type: "LAMBDA" }
  | { type: "OP"; op: "+" | "-" | "=" }
  | { type: "BOOL"; val: boolean }
  | { type: "INT"; val: number }
  | { type: "STR"; val: string }
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
      case "if":
        return { type: "IF" };
      case "lambda":
        return { type: "LAMBDA" };
      case "+":
      case "-":
      case "=":
        return { type: "OP", op: char };
      case "#t":
        return { type: "BOOL", val: true };
      case "#f":
        return { type: "BOOL", val: false };
    }
    if (parseInt(char).toString() === char) {
      return { type: "INT", val: parseInt(char) };
    }
    if (char[0] === '"' && char[char.length - 1] === '"') {
      return { type: "STR", val: char };
    }
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
