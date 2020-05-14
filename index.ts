import { createLexer } from "./lexer.ts";
import { createAST } from "./parser.ts";

function prettyPrint(obj: any) {
  console.log(JSON.stringify(obj, null, 2));
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
