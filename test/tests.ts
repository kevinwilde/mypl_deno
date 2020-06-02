import { createLexer } from "../lexer.ts";
import { createAST } from "../parser.ts";
import { evaluate } from "../interpreter.ts";
import { prettyPrint, printType } from "../utils.ts";
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

function assertType(
  program: string,
  expectedType: string,
) {
  const lexer = createLexer(program);
  const ast = createAST(lexer);
  const actualType = printType(typeCheck(ast));
  const success = actualType === expectedType;
  if (!success) {
    console.log("AST:");
    console.log(prettyPrint(ast));
    console.log("Actual type:");
    console.log(actualType);
    console.log("Expected type:");
    console.log(expectedType);
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
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
});

Deno.test("defining a variable (string)", () => {
  let program = `(let x "hello" x)`;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "hello" });
});

Deno.test("calling a function (with type ann)", () => {
  let program = "((lambda (x:bool) x) #t)";
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: true });
});

Deno.test("calling a function (without type ann)", () => {
  let program = "((lambda (x) x) #t)";
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: true });
});

Deno.test("[TypeError] calling a function", () => {
  let program = "((lambda (x:bool) x) 1)";
  expectTypeError(program);
});

Deno.test("calling a function with multiple args (with type ann)", () => {
  let program = " ((lambda (x:bool y:bool) x) #t #f)";
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: true });
  program = " ((lambda (x:bool y:bool) y) #t #f)";
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: false });
});

Deno.test("calling a function with multiple args (without type ann)", () => {
  let program = " ((lambda (x y) x) #t #f)";
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: true });
  program = " ((lambda (x y) y) #t #f)";
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: false });
});

Deno.test("[TypeError] calling a function with multiple args", () => {
  let program = " ((lambda (x:bool y:bool) x) #t 2)";
  expectTypeError(program);
  program = " ((lambda (x:bool y:bool) x) 2 #t)";
  expectTypeError(program);
});

Deno.test("conditionals (with type ann)", () => {
  let program = "((lambda (x:bool y:int z:int) (if x y z)) #t 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (x:bool y:int z:int) (if x y z)) #f 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("conditionals (wthout type ann)", () => {
  let program = "((lambda (x y z) (if x y z)) #t 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (x y z) (if x y z)) #f 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("[TypeError] conditionals (with type ann)", () => {
  let program = "((lambda (x: bool y: int z : int) (if x y z)) 1 2 3)";
  expectTypeError(program);
  program = `((lambda (x: bool y :int z:int) (if x y z)) #f 1 "hi")`;
  expectTypeError(program);
});

Deno.test("[TypeError] conditionals (without type ann)", () => {
  let program = "((lambda (x y z) (if x y z)) 1 2 3)";
  expectTypeError(program);
  program = `((lambda (x y z) (if x y z)) #f 1 "hi")`;
  expectTypeError(program);
});

Deno.test("addition (with type ann)", () => {
  let program = " (let plus (lambda (x: int y :int) (+ x y)) (plus 2 3))";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 5 });
});

Deno.test("addition (without type ann)", () => {
  let program = " (let plus (lambda (x y) (+ x y)) (plus 2 3))";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 5 });
});

Deno.test("plus fn (without type ann)", () => {
  let program = " (let plus (lambda (x y) (+ x y)) plus)";
  assertType(program, "(-> (int int) int)");
});

Deno.test("[TypeError] stdlib function", () => {
  let program = `(+ "hi" 3)`;
  expectTypeError(program);
  program = `(+ 3 "hi")`;
  expectTypeError(program);
});

Deno.test("[TypeError] using stdlib function (with type ann)", () => {
  let program = `(let plus (lambda (x:int y:int) (+ x y)) (plus "hi" 3))`;
  expectTypeError(program);
  program = `(let plus (lambda (x:int y:int) (+ x y)) (plus 3 "hi"))`;
  expectTypeError(program);
});

Deno.test("[TypeError] using stdlib function (without type ann)", () => {
  let program = `(let plus (lambda (x y) (+ x y)) (plus "hi" 3))`;
  expectTypeError(program);
  program = `(let plus (lambda (x y) (+ x y)) (plus 3 "hi"))`;
  expectTypeError(program);
});

Deno.test("subtraction (with type ann)", () => {
  let program = " (let minus (lambda (x:int y:int) (- x y)) (minus 2 3))";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: -1 });
});

Deno.test("subtraction (without type ann)", () => {
  let program = " (let minus (lambda (x y) (- x y)) (minus 2 3))";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: -1 });
});

Deno.test("conditional with equality (with type ann)", () => {
  let program =
    "((lambda (w:int x:int y:int z:int) (if (= w x) y z)) 42 42 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (w:int x:int y:int z:int) (if (= w x) y z)) 42 43 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("conditional with equality (without type ann)", () => {
  let program = "((lambda (w x y z) (if (= w x) y z)) 42 42 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = "((lambda (w x y z) (if (= w x) y z)) 42 43 1 2)";
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 2 });
});

Deno.test("string-concat", () => {
  let program = `(let x (string-concat "hello" "world") x)`;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "helloworld" });
});

Deno.test("closure (with type ann)", () => {
  let program = `
  (let addN
    (lambda (N:int) (lambda (x:int) (+ x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("closure (without type ann)", () => {
  let program = `
  (let addN
    (lambda (N) (lambda (x) (+ x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("[TypeError] closure (with type ann)", () => {
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

Deno.test("[TypeError] closure (without type ann)", () => {
  let program = `
  (let addN
    (lambda (N) (lambda (x) (+ x N)))
    (let add1
         (addN "hi")
         (add1 42)))
  `;
  expectTypeError(program);
  program = `
  (let addN
    (lambda (N) (lambda (x) (+ x N)))
    (let add1
         (addN 1)
         (add1 "hi")))
  `;
  expectTypeError(program);
  program = `
  (let addN
    (lambda (N) (lambda (x) (string-concat x N)))
    (let add1
         (addN 1)
         (add1 42)))
  `;
  expectTypeError(program);
});

Deno.test("closure not fooled by later shadow - maintains env where defined (with type ann)", () => {
  let program = `
  (let add1
      (let x 1 (lambda (y:int) (+ x y)))
      (let x 2 (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 43 });
  // Even when shadow changes the type
  program = `
  (let add1
      (let x 1 (lambda (y:int) (+ x y)))
      (let x "hi" (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("closure not fooled by later shadow - maintains env where defined (without type ann)", () => {
  let program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x 2 (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 43 });
  // Even when shadow changes the type
  program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x "hi" (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 43 });
});

Deno.test("shadowing (with type ann)", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y:int) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 44 });
  // Even when shadow changes the type
  program = `
  (let add2
      (let x "hi" (let x 2 (lambda (y:int) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 44 });
});

Deno.test("shadowing (without type ann)", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 44 });
  // Even when shadow changes the type
  program = `
  (let add2
      (let x "hi" (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 44 });
});

Deno.test("first class functions (with type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f : (-> ( int) int) x: int) (f (f x)))
      (let add1
          (lambda (x:int) (+ x 1))
          (doTwice add1 5)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 7 });
});

Deno.test("first class functions (without type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f x) (f (f x)))
      (let add1
          (lambda (x) (+ x 1))
          (doTwice add1 5)))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 7 });
});

Deno.test("[TypeError] first class functions (with type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f : (-> ( int ) int) x: int) (f (f x)))
      (let add1
          (lambda (x:int) (+ x 1))
          (doTwice add1 "hi")))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
      (lambda (f : (-> (int ) int) x: int) (f (f x)))
      (let add1
          (lambda (x:str) (string-concat x "world"))
          (doTwice add1 "hi")))
  `;
  expectTypeError(program);
});

Deno.test("[TypeError] first class functions (without type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f x) (f (f x)))
      (let add1
          (lambda (x) (+ x 1))
          (doTwice add1 "hi")))
  `;
  expectTypeError(program);

  // no type error here! Unlike version with type ann
  program = `
  (let doTwice
      (lambda (f x) (f (f x)))
      (let add1
          (lambda (x) (string-concat x "world"))
          (doTwice add1 "hi")))
  `;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "hiworldworld" });
});

Deno.test("first class function with stdlib (with type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f:(-> (int int) int) x:int y:int) (f x (f x y)))
      (doTwice + 5 8))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 18 });
  program = `
  (let doTwice
      (lambda (f:(-> (str str) str) x:str y:str) (f x (f x y)))
      (doTwice string-concat "Be" " Rhexa"))
  `;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "BeBe Rhexa" });
});

Deno.test("first class function with stdlib (without type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f x y) (f x (f x y)))
      (doTwice + 5 8))
  `;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 18 });
  program = `
  (let doTwice
      (lambda (f x y) (f x (f x y)))
      (doTwice string-concat "Be" " Rhexa"))
  `;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "BeBe Rhexa" });
});

Deno.test("[TypeError] first class functions (with type ann)", () => {
  let program = `
  (let doTwice
    (lambda (f:(-> (int int) int) x:int y:int) (f x (f x y)))
    (doTwice string-concat 5 8))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f:(-> (int int) int) x:int y:int) (f x (f x y)))
    (doTwice + 5 "hi"))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f:(-> (str str) str) x:str y:str) (f x (f x y)))
    (doTwice + "Be" " Rhexa"))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f:(-> (str str) str) x:str y:str) (f x (f x y)))
    (doTwice string-concat 2 " Rhexa"))
  `;
  expectTypeError(program);
});

Deno.test("[TypeError] first class functions (without type ann)", () => {
  let program = `
  (let doTwice
    (lambda (f x y) (f x (f x y)))
    (doTwice string-concat 5 8))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f x y) (f x (f x y)))
    (doTwice + 5 "hi"))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f x y) (f x (f x y)))
    (doTwice + "Be" " Rhexa"))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f x y) (f x (f x y)))
    (doTwice string-concat 2 " Rhexa"))
  `;
  expectTypeError(program);
});

Deno.test("naive factorial (with type ann)", () => {
  const g = `
    (lambda (fct: (-> (int) int))
      (lambda (n: int)
        (if (= n 0)
          1
          (* n (fct (- n 1))))))
  `;
  let program = `(let factorial (fix ${g}) (factorial 0))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial (fix ${g}) (factorial 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial (fix ${g}) (factorial 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let factorial (fix ${g}) (factorial 3))`;
  assertResult(program, { tag: "TmInt", val: 6 });
  program = `(let factorial (fix ${g}) (factorial 4))`;
  assertResult(program, { tag: "TmInt", val: 24 });
});

Deno.test("naive factorial (without type ann)", () => {
  const g = `
    (lambda (fct)
      (lambda (n)
        (if (= n 0)
          1
          (* n (fct (- n 1))))))
  `;
  let program = `(let factorial (fix ${g}) (factorial 0))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial (fix ${g}) (factorial 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial (fix ${g}) (factorial 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let factorial (fix ${g}) (factorial 3))`;
  assertResult(program, { tag: "TmInt", val: 6 });
  program = `(let factorial (fix ${g}) (factorial 4))`;
  assertResult(program, { tag: "TmInt", val: 24 });
  program = `(let factorial (fix ${g}) (+ (factorial 4) (factorial 3)))`;
  assertResult(program, { tag: "TmInt", val: 30 });
});

Deno.test("recursive function that takes int returns str", () => {
  const g = `
    (lambda (append-n : (-> (int) str))
      (lambda (n: int)
        (if (= n 0)
          ""
          (string-concat "a" (append-n (- n 1))))))
  `;
  let program = `(let myFunc (fix ${g}) (myFunc 0))`;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "" });
  program = `(let myFunc (fix ${g}) (myFunc 1))`;
  assertResult(program, { tag: "TmStr", val: "a" });
  program = `(let myFunc (fix ${g}) (myFunc 2))`;
  assertResult(program, { tag: "TmStr", val: "aa" });
  program = `(string-concat (let myFunc (fix ${g}) (myFunc 2)) "b")`;
  assertResult(program, { tag: "TmStr", val: "aab" });
});

Deno.test("naive fibonacci", () => {
  const g = `
    (lambda (fib)
      (lambda (n)
        (if (= n 0)
          1
          (if (= n 1)
            1
            (+ (fib (- n 1)) (fib (- n 2)))))))
  `;
  let program = `(let fibonacci (fix ${g}) (fibonacci 0))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let fibonacci (fix ${g}) (fibonacci 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let fibonacci (fix ${g}) (fibonacci 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let fibonacci (fix ${g}) (fibonacci 3))`;
  assertResult(program, { tag: "TmInt", val: 3 });
  program = `(let fibonacci (fix ${g}) (fibonacci 4))`;
  assertResult(program, { tag: "TmInt", val: 5 });
  program = `(let fibonacci (fix ${g}) (fibonacci 5))`;
  assertResult(program, { tag: "TmInt", val: 8 });
  program = `(let fibonacci (fix ${g}) (+ (fibonacci 5) (fibonacci 6)))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 21 });
});

Deno.test("identity fn", () => {
  let program = "(lambda (x) x)";
  assertType(program, "(-> ('a) 'a)");
});

Deno.test("type inference on function", () => {
  let program = "(lambda (x y) (if x 0 1))";
  assertType(program, "(-> (bool 'a) int)");
});

Deno.test("type inference on functions with free types", () => {
  let program = "(lambda (x y) (if x y y))";
  assertType(program, "(-> (bool 'a) 'a)");
  program = "(lambda (x y z) (if x y z))";
  assertType(program, "(-> (bool 'a 'a) 'a)");
  program = "(lambda (x y z) (if x y y))";
  assertType(program, "(-> (bool 'a 'b) 'a)");
  program = "(lambda (x y z) (if x z z))";
  assertType(program, "(-> (bool 'a 'b) 'b)");
  program =
    "(lambda (x y z1 z2 z3 z4 z5 z6 z7 z8 z9 z10 z11 z12 z13 z14 z15) (if x 0 y))";
  assertType(
    program,
    "(-> (bool int 'a 'b 'c 'd 'e 'f 'g 'h 'i 'j 'k 'l 'm 'n 'o) int)",
  );
});
