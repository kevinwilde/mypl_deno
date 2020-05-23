import { createLexer } from "../lexer.ts";
import { createAST } from "../parser.ts";
import { evaluate } from "../interpreter.ts";
import { prettyPrint } from "../utils.ts";
import { typeCheck } from "../typechecker.ts";

function assertResult(
  program: string,
  expectedResult: ReturnType<typeof evaluate>,
) {
  const lexer = createLexer(program);
  const ast = createAST(lexer);
  const _ = typeCheck(ast);
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

function expectTypeError(program: string) {
  const lexer = createLexer(program);
  const ast = createAST(lexer);
  let res;
  try {
    res = typeCheck(ast);
  } catch (e) {
    // success
    return;
  }
  console.log("Actual result:");
  console.log(prettyPrint(res));
  console.log(`Expected type error`);
  throw new Error("Test failed");
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
  let program = "((lambda (x:bool) x) #t)";
  assertResult(program, { tag: "TmBool", val: true });
});

Deno.test("[TypeError] calling a function", () => {
  let program = "((lambda (x:bool) x) 1)";
  expectTypeError(program);
});

Deno.test("calling a function with multiple args", () => {
  let program = " ((lambda (x:bool y:bool) x) #t #f)";
  assertResult(program, { tag: "TmBool", val: true });
  program = " ((lambda (x:bool y:bool) y) #t #f)";
  assertResult(program, { tag: "TmBool", val: false });
});

Deno.test("[TypeError] calling a function with multiple args", () => {
  let program = " ((lambda (x:bool y:bool) x) #t 2)";
  expectTypeError(program);
  program = " ((lambda (x:bool y:bool) x) 2 #t)";
  expectTypeError(program);
});

Deno.test("conditionals", () => {
  let program = "((lambda (x:bool y:int z:int) (if x y z)) #t 1 2)";
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (x:bool y:int z:int) (if x y z)) #f 1 2)";
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("[TypeError] conditionals", () => {
  let program = "((lambda (x:bool y:int z:int) (if x y z)) 1 2 3)";
  expectTypeError(program);
  program = `((lambda (x:bool y:int z:int) (if x y z)) #f 1 "hi")`;
  expectTypeError(program);
});

Deno.test("addition", () => {
  let program = " (let plus (lambda (x:int y:int) (+ x y)) (plus 2 3))";
  assertResult(program, { tag: "TmInt", val: 5 });
});

Deno.test("[TypeError] stdlib function", () => {
  let program = `(+ "hi" 3)`;
  expectTypeError(program);
  program = `(+ 3 "hi")`;
  expectTypeError(program);
  program = `(let plus (lambda (x:int y:int) (+ x y)) (plus "hi" 3))`;
  expectTypeError(program);
  program = `(let plus (lambda (x:int y:int) (+ x y)) (plus 3 "hi"))`;
  expectTypeError(program);
});

Deno.test("subtraction", () => {
  let program = " (let minus (lambda (x:int y:int) (- x y)) (minus 2 3))";
  assertResult(program, { tag: "TmInt", val: -1 });
});

Deno.test("conditional with equality", () => {
  let program =
    "((lambda (w:int x:int y:int z:int) (if (= w x) y z)) 42 42 1 2)";
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (w:int x:int y:int z:int) (if (= w x) y z)) 42 43 1 2)";
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("string-concat", () => {
  let program = `(let x (string-concat "hello" "world") x)`;
  assertResult(program, { tag: "TmStr", val: "helloworld" });
});

Deno.test("closure", () => {
  let program = `
  (let addN
    (lambda (N:int) (lambda (x:int) (+ x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("[TypeError] closure", () => {
  let program = `
  (let addN
    (lambda (N:int) (lambda (x:int) (+ x N)))
    (let add1
         (addN "hi")
         (add1 42)))
  `;
  expectTypeError(program);
  program = `
  (let addN
    (lambda (N:int) (lambda (x:int) (+ x N)))
    (let add1
         (addN 1)
         (add1 "hi")))
  `;
  expectTypeError(program);
  program = `
  (let addN
    (lambda (N:int) (lambda (x:int) (string-concat x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  expectTypeError(program);
});

Deno.test("closure not fooled by later shadow - maintains env where defined", () => {
  let program = `
  (let add1
      (let x 1 (lambda (y:int) (+ x y)))
      (let x 2 (add1 42)))
  `;
  assertResult(program, { tag: "TmInt", val: 43 });
  // Even when shadow changes the type
  program = `
  (let add1
      (let x 1 (lambda (y:int) (+ x y)))
      (let x "hi" (add1 42)))
  `;
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("shadowing", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y:int) (+ x y))))
      (add2 42))
  `;
  assertResult(program, { tag: "TmInt", val: 44 });
  // Even when shadow changes the type
  program = `
  (let add2
      (let x "hi" (let x 2 (lambda (y:int) (+ x y))))
      (add2 42))
  `;
  assertResult(program, { tag: "TmInt", val: 44 });
});

Deno.test("first class functions", () => {
  let program = `
  (let doTwice
      (lambda (f:(int)->int x:int) (f (f x)))
      (let add1
          (lambda (x:int) (+ x 1))
          (doTwice add1 5)))
  `;
  assertResult(program, { tag: "TmInt", val: 7 });
});

Deno.test("first class function with stdlib", () => {
  let program = `
  (let doTwice
      (lambda (f:(int int)->int x:int y:int) (f x (f x y)))
      (doTwice + 5 8))
  `;
  assertResult(program, { tag: "TmInt", val: 18 });
  program = `
  (let doTwice
      (lambda (f:(str str)->str x:str y:str) (f x (f x y)))
      (doTwice string-concat "Be" " Rhexa"))
  `;
  assertResult(program, { tag: "TmStr", val: "BeBe Rhexa" });
});

// Deno.test("naive factorial", () => {
//   const fix = `
//     (lambda (f)
//       ((lambda (x)
//           (f (lambda (y) ((x x) y))))
//         (lambda (x)
//           (f (lambda (y) ((x x) y))))))
//   `;
//   const g = `
//     (lambda (fct)
//       (lambda (n)
//         (if (= n 0)
//           1
//           (* n (fct (- n 1))))))
//   `;
//   let program = `(let factorial (${fix} ${g}) (factorial 0))`;
//   assertResult(program, { tag: "TmInt", val: 1 });
//   program = `(let factorial (${fix} ${g}) (factorial 1))`;
//   assertResult(program, { tag: "TmInt", val: 1 });
//   program = `(let factorial (${fix} ${g}) (factorial 2))`;
//   assertResult(program, { tag: "TmInt", val: 2 });
//   program = `(let factorial (${fix} ${g}) (factorial 3))`;
//   assertResult(program, { tag: "TmInt", val: 6 });
//   program = `(let factorial (${fix} ${g}) (factorial 4))`;
//   assertResult(program, { tag: "TmInt", val: 24 });
// });

// Deno.test("naive fibonacci", () => {
//   const fix = `
//     (lambda (f)
//       ((lambda (x)
//           (f (lambda (y) ((x x) y))))
//         (lambda (x)
//           (f (lambda (y) ((x x) y))))))
//   `;
//   const g = `
//     (lambda (fib)
//       (lambda (n)
//         (if (= n 0)
//           1
//           (if (= n 1)
//             1
//             (+ (fib (- n 1)) (fib (- n 2)))))))
//   `;
//   let program = `(let fibonacci (${fix} ${g}) (fibonacci 0))`;
//   assertResult(program, { tag: "TmInt", val: 1 });
//   program = `(let fibonacci (${fix} ${g}) (fibonacci 1))`;
//   assertResult(program, { tag: "TmInt", val: 1 });
//   program = `(let fibonacci (${fix} ${g}) (fibonacci 2))`;
//   assertResult(program, { tag: "TmInt", val: 2 });
//   program = `(let fibonacci (${fix} ${g}) (fibonacci 3))`;
//   assertResult(program, { tag: "TmInt", val: 3 });
//   program = `(let fibonacci (${fix} ${g}) (fibonacci 4))`;
//   assertResult(program, { tag: "TmInt", val: 5 });
//   program = `(let fibonacci (${fix} ${g}) (fibonacci 5))`;
//   assertResult(program, { tag: "TmInt", val: 8 });
// });
