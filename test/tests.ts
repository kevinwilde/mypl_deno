import { createLexer } from "../lexer.ts";
import { createAST } from "../parser.ts";
import { evaluate } from "../interpreter.ts";
import { prettyPrint } from "../utils.ts";

function assertResult(
  program: string,
  expectedResult: ReturnType<typeof evaluate>,
) {
  const lexer = createLexer(program);
  const ast = createAST(lexer);
  const actualResult = evaluate(ast);
  function getTestResult() {
    switch (actualResult.type) {
      case "BOOL":
        return expectedResult.type === "BOOL" &&
          actualResult.val === expectedResult.val;
      case "INT":
        return expectedResult.type === "INT" &&
          actualResult.val === expectedResult.val;
      case "CLOSURE":
        return false; // TODO ?
      default:
        const _exhaustiveCheck: never = actualResult;
    }
  }
  const success = getTestResult();
  if (!success) {
    console.log("AST:");
    console.log(prettyPrint(ast));
    console.log("Actual result:");
    console.log(prettyPrint(actualResult));
    console.log("Expected result:");
    console.log(prettyPrint(expectedResult));
    throw new Error("Test failed");
  }
}

Deno.test("defining a variable", () => {
  let program = "(let x 1 x)";
  assertResult(program, { type: "INT", val: 1 });
});

Deno.test("calling a function", () => {
  let program = "((lambda (x) x) #t)";
  assertResult(program, { type: "BOOL", val: true });
});

Deno.test("calling a function with multiple args", () => {
  let program = " ((lambda (x y) x) #t #f)";
  assertResult(program, { type: "BOOL", val: true });
  program = " ((lambda (x y) y) #t #f)";
  assertResult(program, { type: "BOOL", val: false });
});

Deno.test("conditionals", () => {
  let program = "((lambda (x y z) (if x y z)) #t 1 2)";
  assertResult(program, { type: "INT", val: 1 });
  program = "((lambda (x y z) (if x y z)) #f 1 2)";
  assertResult(program, { type: "INT", val: 2 });
});

Deno.test("addition", () => {
  let program = " (let plus (lambda (x y) (+ x y)) (plus 2 3))";
  assertResult(program, { type: "INT", val: 5 });
});

Deno.test("subtraction", () => {
  let program = " (let minus (lambda (x y) (- x y)) (minus 2 3))";
  assertResult(program, { type: "INT", val: -1 });
});

Deno.test("closure", () => {
  let program = `
  (let addN
    (lambda (N) (lambda (x) (+ x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  assertResult(program, { type: "INT", val: 43 });
});

Deno.test("closure not fooled by later shadow - maintains env where defined", () => {
  let program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x 2 (add1 42)))
  `;
  assertResult(program, { type: "INT", val: 43 });
});

Deno.test("shadowing", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertResult(program, { type: "INT", val: 44 });
});
