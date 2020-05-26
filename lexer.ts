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
  const input = s.trim();

  function calculateNextToken(): {
    token: Token | null;
    nextTokenStart: number;
  } {
    if (i >= input.length) {
      return { token: null, nextTokenStart: i };
    }
    let char = "";
    let j = i;
    if (input[j] === '"') {
      // Handle strings
      char += input[j];
      j++;
      while (j < input.length && input[j] !== '"') {
        char += input[j];
        j++;
      }
      char += input[j];
      j++;
    } else if (input[j] === "(" || input[j] === ")") {
      // Handle parens
      char += input[j];
      j++;
    } else {
      // Handle all other tokens
      // chars which signal end of token:
      // - whitespace
      // - parens
      while (j < input.length && !/(\s|\(|\))/.test(input[j])) {
        char += input[j];
        j++;
      }
    }
    // Eat up extra whitespace before next token
    while (j < input.length && /\s/.test(input[j])) {
      j++;
    }

    function charToToken(): Token | null {
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

    return { token: charToToken(), nextTokenStart: j };
  }
  return {
    peek: () => {
      return calculateNextToken().token;
    },
    nextToken: () => {
      const result = calculateNextToken();
      i = result.nextTokenStart;
      return result.token;
    },
  };
}
