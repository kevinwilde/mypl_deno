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
    switch (actualResult.tag) {
      case "TmBool":
        return expectedResult.tag === "TmBool" &&
          actualResult.val === expectedResult.val;
      case "TmInt":
        return expectedResult.tag === "TmInt" &&
          actualResult.val === expectedResult.val;
      case "TmStr":
        return expectedResult.tag === "TmStr" &&
          actualResult.val === expectedResult.val;
      case "TmStdlibFun":
      case "TmClosure":
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

Deno.test("defining a variable (int)", () => {
  let program = "(let x 1 x)";
  assertResult(program, { tag: "TmInt", val: 1 });
});

Deno.test("defining a variable (string)", () => {
  let program = `(let x "hello" x)`;
  assertResult(program, { tag: "TmStr", val: "hello" });
});

Deno.test("calling a function", () => {
  let program = "((lambda (x) x) #t)";
  assertResult(program, { tag: "TmBool", val: true });
});

Deno.test("calling a function with multiple args", () => {
  let program = " ((lambda (x y) x) #t #f)";
  assertResult(program, { tag: "TmBool", val: true });
  program = " ((lambda (x y) y) #t #f)";
  assertResult(program, { tag: "TmBool", val: false });
});

Deno.test("conditionals", () => {
  let program = "((lambda (x y z) (if x y z)) #t 1 2)";
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (x y z) (if x y z)) #f 1 2)";
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("addition", () => {
  let program = " (let plus (lambda (x y) (+ x y)) (plus 2 3))";
  assertResult(program, { tag: "TmInt", val: 5 });
});

Deno.test("subtraction", () => {
  let program = " (let minus (lambda (x y) (- x y)) (minus 2 3))";
  assertResult(program, { tag: "TmInt", val: -1 });
});

Deno.test("conditional with equality", () => {
  let program = "((lambda (w x y z) (if (= w x) y z)) 42 42 1 2)";
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (w x y z) (if (= w x) y z)) 42 43 1 2)";
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("string-concat", () => {
  let program = `(let x (string-concat "hello" "world") x)`;
  assertResult(program, { tag: "TmStr", val: "helloworld" });
});

Deno.test("closure", () => {
  let program = `
  (let addN
    (lambda (N) (lambda (x) (+ x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("closure not fooled by later shadow - maintains env where defined", () => {
  let program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x 2 (add1 42)))
  `;
  assertResult(program, { tag: "TmInt", val: 43 });
  // Even when shadow changes the type
  program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x "hi" (add1 42)))
  `;
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("shadowing", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertResult(program, { tag: "TmInt", val: 44 });
  // Even when shadow changes the type
  program = `
  (let add2
      (let x "hi" (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertResult(program, { tag: "TmInt", val: 44 });
});

Deno.test("first class functions", () => {
  let program = `
  (let doTwice
      (lambda (f x) (f (f x)))
      (let add1
          (lambda (x) (+ x 1))
          (doTwice add1 5)))
  `;
  assertResult(program, { tag: "TmInt", val: 7 });
});

Deno.test("first class function with stdlib", () => {
  let program = `
  (let doTwice
      (lambda (f x y) (f x (f x y)))
      (doTwice + 5 8))
  `;
  assertResult(program, { tag: "TmInt", val: 18 });
  program = `
  (let doTwice
      (lambda (f x y) (f x (f x y)))
      (doTwice string-concat "Be" " Rhexa"))
  `;
  assertResult(program, { tag: "TmStr", val: "BeBe Rhexa" });
});

Deno.test("naive factorial", () => {
  const fix = `
    (lambda (f)
      ((lambda (x)
          (f (lambda (y) ((x x) y))))
        (lambda (x)
          (f (lambda (y) ((x x) y))))))
  `;
  const g = `
    (lambda (fct)
      (lambda (n)
        (if (= n 0)
          1
          (* n (fct (- n 1))))))
  `;
  let program = `(let factorial (${fix} ${g}) (factorial 0))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial (${fix} ${g}) (factorial 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial (${fix} ${g}) (factorial 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let factorial (${fix} ${g}) (factorial 3))`;
  assertResult(program, { tag: "TmInt", val: 6 });
  program = `(let factorial (${fix} ${g}) (factorial 4))`;
  assertResult(program, { tag: "TmInt", val: 24 });
});

Deno.test("naive fibonacci", () => {
  const fix = `
    (lambda (f)
      ((lambda (x)
          (f (lambda (y) ((x x) y))))
        (lambda (x)
          (f (lambda (y) ((x x) y))))))
  `;
  const g = `
    (lambda (fib)
      (lambda (n)
        (if (= n 0)
          1
          (if (= n 1)
            1
            (+ (fib (- n 1)) (fib (- n 2)))))))
  `;
  let program = `(let fibonacci (${fix} ${g}) (fibonacci 0))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let fibonacci (${fix} ${g}) (fibonacci 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let fibonacci (${fix} ${g}) (fibonacci 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let fibonacci (${fix} ${g}) (fibonacci 3))`;
  assertResult(program, { tag: "TmInt", val: 3 });
  program = `(let fibonacci (${fix} ${g}) (fibonacci 4))`;
  assertResult(program, { tag: "TmInt", val: 5 });
  program = `(let fibonacci (${fix} ${g}) (fibonacci 5))`;
  assertResult(program, { tag: "TmInt", val: 8 });
});
