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
printTestCase("  (let y (lambda (x:int) (+ 1 x)) y)");
printTestCase("  (let y (lambda (x:int z:int) (+ z x)) y)");
printTestCase("  ((lambda (x:bool) x) #t)");
printTestCase("  ((lambda (x:bool y:bool) x) #t #f)");
printTestCase("  ((lambda (x:bool y:bool) y) #t #f)");
printTestCase("  ((lambda (x:bool y:int z:int) (if x y z)) #t 1 2)");
printTestCase("  ((lambda (x:bool y:int z:int) (if x y z)) #f 1 2)");
printTestCase(`  (let plus (lambda (x:int y:int) (+ x y)) (plus 2 3))`);
printTestCase(`  (let sub (lambda (x:int y:int) (- x y)) (sub 2 3))`);
printTestCase(
  `(let addN
        (lambda (N:int) (lambda (x:int) (+ x N)))
        (let add1
             (addN 1)
             (add1 42)))`,
);
