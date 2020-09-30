type Token =
  | { tag: "LPAREN" }
  | { tag: "RPAREN" }
  | { tag: "COLON" }
  | { tag: "ARROW" }
  | { tag: "LET" }
  | { tag: "IF" }
  | { tag: "AND" }
  | { tag: "OR" }
  | { tag: "LAMBDA" }
  | { tag: "EMPTY" }
  | { tag: "BOOL"; val: boolean }
  | { tag: "INT"; val: number }
  | { tag: "STR"; val: string }
  | { tag: "IDEN"; name: string };

export type Lexer = { peek: () => Token | null; nextToken: () => Token | null };

export function createLexer(s: string): Lexer {
  let i = 0;
  const input = s.trim();

  function calculateNextToken(): [Token | null, number] {
    let j = i;
    // Eat up extra whitespace before token
    while (j < input.length && /\s/.test(input[j])) {
      j++;
    }
    if (j >= input.length) {
      return [null, j];
    }

    let char = "";
    let startIdx = j;
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
    } else if (input[j] === "{" || input[j] === "}") {
      // Handle curly braces
      char += input[j];
      j++;
    } else if (input[j] === ":") {
      // Handle colon
      char += input[j];
      j++;
    } else if (input[j] === "-" && input[j + 1] === ">") {
      // Handle arrow
      char += input[j];
      j++;
      char += input[j];
      j++;
    } else {
      // Handle all other tokens
      // chars which signal end of token:
      // - whitespace
      // - parens
      // - curly braces
      // - colon
      // don't need arrow since it can only come after paren when used in type ann
      while (j < input.length && !/(\s|\(|\)|\{|\}|\:)/.test(input[j])) {
        char += input[j];
        j++;
      }
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
        case ":":
          return { tag: "COLON" };
        case "->":
          return { tag: "ARROW" };
        case "let":
          return { tag: "LET" };
        case "if":
          return { tag: "IF" };
        case "and":
          return { tag: "AND" };
        case "or":
          return { tag: "OR" };
        case "lambda":
          return { tag: "LAMBDA" };
        case "empty":
          return { tag: "EMPTY" };
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

    const token = charToToken();
    if (!token) {
      return [null, j];
    }
    return [token, j];
  }
  return {
    peek: () => {
      return calculateNextToken()[0];
    },
    nextToken: () => {
      const [result, endIdx] = calculateNextToken();
      if (result) {
        i = endIdx;
      }
      return result;
    },
  };
}
