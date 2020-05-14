import { createLexer } from "./lexer.ts";
import { createAST } from "./parser.ts";
import { evaluate } from "./interpreter.ts";
import { prettyPrint } from "./utils.ts";

/// Test
function printTestCase(program: string) {
  console.log("=========================================================");
  const lexer = createLexer(program);
  const ast = createAST(lexer);
  console.log(prettyPrint(ast));
  console.log((evaluate(ast)));
  console.log("=========================================================");
}

printTestCase("(let x 1 x)");
printTestCase("  (let y (lambda (x) (succ x)) y)");
printTestCase("  (let y (lambda (x) (+ 1 x)) y)");
printTestCase("  (let y (lambda (x z) (+ z x)) y)");
