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
// printTestCase("  (let y (lambda (x) (succ x)) y)");
printTestCase("  (let y (lambda (x) (+ 1 x)) y)");
printTestCase("  (let y (lambda (x z) (+ z x)) y)");
printTestCase("  ((lambda (x) x) #t)");
printTestCase("  ((lambda (x y) x) #t #f)");
printTestCase("  ((lambda (x y) y) #t #f)");
printTestCase("  ((lambda (x y z) (if x y z)) #t 1 2)");
printTestCase("  ((lambda (x y z) (if x y z)) #f 1 2)");
printTestCase(`  (let plus (lambda (x y) (+ x y)) (plus 2 3))`);
printTestCase(`  (let sub (lambda (x y) (- x y)) (sub 2 3))`);
printTestCase(
  `(let addN
        (lambda (N) (lambda (x) (+ x N)))
        (let add1
             (addN 1)
             (add1 42)))`,
);
