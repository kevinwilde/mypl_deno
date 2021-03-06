import { createLexer } from "../lexer.ts";
import { createAST } from "../parser.ts";
import { evaluate } from "../interpreter.ts";
import { prettyPrint, printType, printValue } from "../utils.ts";
import { typeCheck } from "../typechecker.ts";

function assertResult(program: string, expectedResult: string) {
  const lexer = createLexer(program);
  const ast = createAST(lexer);
  const _ = typeCheck(ast);
  const actualResult = printValue(evaluate(ast));
  const success = actualResult === expectedResult;
  if (!success) {
    console.log("AST:");
    console.log(prettyPrint(ast));
    console.log("Actual result:");
    console.log(actualResult);
    console.log("Expected result:");
    console.log(expectedResult);
    throw new Error("Test failed");
  }
}

function assertType(program: string, expectedType: string) {
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
  assertResult(program, `1`);
});

Deno.test("defining a variable (string)", () => {
  let program = `(let x "hello" x)`;
  assertType(program, "str");
  assertResult(program, `"hello"`);
});

Deno.test("defining a variable (bool)", () => {
  let program = "(let x #t x)";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = "(let x #f x)";
  assertType(program, "bool");
  assertResult(program, `#f`);
});

Deno.test("not", () => {
  let program = "(let x #t (not x))";
  assertType(program, "bool");
  assertResult(program, `#f`);
  program = "(let x #f (not x))";
  assertType(program, "bool");
  assertResult(program, `#t`);
});

Deno.test("and", () => {
  let program = "(let x #t (and (not x) x))";
  assertType(program, "bool");
  assertResult(program, `#f`);
  program = "(let x #f (and (not x) #t))";
  assertType(program, "bool");
  assertResult(program, `#t`);
});

Deno.test("or", () => {
  let program = "(let x #t (or (not x) x))";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = "(let x #t (or (not x) #f))";
  assertType(program, "bool");
  assertResult(program, `#f`);
});

Deno.test("=", () => {
  let program = "=";
  assertType(program, "(-> 'a 'a bool)");

  program = "(= 2 2)";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = "(= 2 3)";
  assertType(program, "bool");
  assertResult(program, `#f`);

  program = "(= #f #f)";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = "(= #f #t)";
  assertType(program, "bool");
  assertResult(program, `#f`);

  program = `(= "hi" "hi")`;
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = `(= "hi" "bye")`;
  assertType(program, "bool");
  assertResult(program, `#f`);

  program = "(= empty empty)";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = "(= (cons 2 empty) (cons 2 empty))";
  assertType(program, "bool");
  assertResult(program, `#f`);
  program = "(let x (cons 2 empty) (= x x))";
  assertType(program, "bool");
  assertResult(program, `#t`);
});

Deno.test("calling a function (with type ann)", () => {
  let program = "((lambda (x:bool) x) #t)";
  assertType(program, "bool");
  assertResult(program, `#t`);
});

Deno.test("calling a function (without type ann)", () => {
  let program = "((lambda (x) x) #t)";
  assertType(program, "bool");
  assertResult(program, `#t`);
});

Deno.test("[TypeError] calling a function", () => {
  let program = "((lambda (x:bool) x) 1)";
  expectTypeError(program);
});

Deno.test("calling a function with multiple args (with type ann)", () => {
  let program = " ((lambda (x:bool y:bool) x) #t #f)";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = " ((lambda (x:bool y:bool) y) #t #f)";
  assertType(program, "bool");
  assertResult(program, `#f`);
});

Deno.test("calling a function with multiple args (without type ann)", () => {
  let program = " ((lambda (x y) x) #t #f)";
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = " ((lambda (x y) y) #t #f)";
  assertType(program, "bool");
  assertResult(program, `#f`);
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
  assertResult(program, `1`);
  program = "((lambda (x:bool y:int z:int) (if x y z)) #f 1 2)";
  assertType(program, "int");
  assertResult(program, `2`);
});

Deno.test("conditionals (wthout type ann)", () => {
  let program = "((lambda (x y z) (if x y z)) #t 1 2)";
  assertType(program, "int");
  assertResult(program, `1`);
  program = "((lambda (x y z) (if x y z)) #f 1 2)";
  assertType(program, "int");
  assertResult(program, `2`);
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
  assertResult(program, `5`);
});

Deno.test("addition (without type ann)", () => {
  let program = " (let plus (lambda (x y) (+ x y)) (plus 2 3))";
  assertType(program, "int");
  assertResult(program, `5`);
});

Deno.test("plus fn (without type ann)", () => {
  let program = " (let plus (lambda (x y) (+ x y)) plus)";
  assertType(program, "(-> int int int)");
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
  assertResult(program, `-1`);
});

Deno.test("subtraction (without type ann)", () => {
  let program = " (let minus (lambda (x y) (- x y)) (minus 2 3))";
  assertType(program, "int");
  assertResult(program, `-1`);
});

Deno.test("conditional with equality (with type ann)", () => {
  let program =
    "((lambda (w:int x:int y:int z:int) (if (= w x) y z)) 42 42 1 2)";
  assertType(program, "int");
  assertResult(program, `1`);
  program = "((lambda (w:int x:int y:int z:int) (if (= w x) y z)) 42 43 1 2)";
  assertType(program, "int");
  assertResult(program, `2`);
});

Deno.test("conditional with equality (without type ann)", () => {
  let program = "((lambda (w x y z) (if (= w x) y z)) 42 42 1 2)";
  assertType(program, "int");
  assertResult(program, `1`);
  program = "((lambda (w x y z) (if (= w x) y z)) 42 43 1 2)";
  assertType(program, "int");
  assertResult(program, `2`);
});

Deno.test("string-length", () => {
  let program = `(string-length "hello")`;
  assertType(program, `int`);
  assertResult(program, `5`);
});

Deno.test("string->list", () => {
  let program = `(string->list "hello")`;
  assertType(program, `(Listof str)`);
  assertResult(
    program,
    `(cons "h" (cons "e" (cons "l" (cons "l" (cons "o" empty)))))`,
  );
});

Deno.test("string-concat", () => {
  let program = `(let x (string-concat "hello" "world") x)`;
  assertType(program, "str");
  assertResult(program, `"helloworld"`);
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
  assertResult(program, `43`);
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
  assertResult(program, `43`);
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
  assertResult(program, `43`);
  // Even when shadow changes the type
  program = `
  (let add1
      (let x 1 (lambda (y:int) (+ x y)))
      (let x "hi" (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, `43`);
});

Deno.test("closure not fooled by later shadow - maintains env where defined (without type ann)", () => {
  let program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x 2 (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, `43`);
  // Even when shadow changes the type
  program = `
  (let add1
      (let x 1 (lambda (y) (+ x y)))
      (let x "hi" (add1 42)))
  `;
  assertType(program, "int");
  assertResult(program, `43`);
});

Deno.test("shadowing (with type ann)", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y:int) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, `44`);
  // Even when shadow changes the type
  program = `
  (let add2
      (let x "hi" (let x 2 (lambda (y:int) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, `44`);
});

Deno.test("shadowing (without type ann)", () => {
  let program = `
  (let add2
      (let x 1 (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, `44`);
  // Even when shadow changes the type
  program = `
  (let add2
      (let x "hi" (let x 2 (lambda (y) (+ x y))))
      (add2 42))
  `;
  assertType(program, "int");
  assertResult(program, `44`);
});

Deno.test("first class functions (with type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f : (-> int int) x: int) (f (f x)))
      (let add1
          (lambda (x:int) (+ x 1))
          (doTwice add1 5)))
  `;
  assertType(program, "int");
  assertResult(program, `7`);
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
  assertResult(program, `7`);
});

Deno.test("[TypeError] first class functions (with type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f : (-> int  int) x: int) (f (f x)))
      (let add1
          (lambda (x:int) (+ x 1))
          (doTwice add1 "hi")))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
      (lambda (f : (-> int  int) x: int) (f (f x)))
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
  assertResult(program, `"hiworldworld"`);
});

Deno.test("first class function with stdlib (with type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f:(-> int int int) x:int y:int) (f x (f x y)))
      (doTwice + 5 8))
  `;
  assertType(program, "int");
  assertResult(program, `18`);
  program = `
  (let doTwice
      (lambda (f:(-> str str str) x:str y:str) (f x (f x y)))
      (doTwice string-concat "Be" " Rhexa"))
  `;
  assertType(program, "str");
  assertResult(program, `"BeBe Rhexa"`);
});

Deno.test("first class function with stdlib (without type ann)", () => {
  let program = `
  (let doTwice
      (lambda (f x y) (f x (f x y)))
      (doTwice + 5 8))
  `;
  assertType(program, "int");
  assertResult(program, `18`);
  program = `
  (let doTwice
      (lambda (f x y) (f x (f x y)))
      (doTwice string-concat "Be" " Rhexa"))
  `;
  assertType(program, "str");
  assertResult(program, `"BeBe Rhexa"`);
});

Deno.test("[TypeError] first class functions (with type ann)", () => {
  let program = `
  (let doTwice
    (lambda (f:(-> int int int) x:int y:int) (f x (f x y)))
    (doTwice string-concat 5 8))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f:(-> int int int) x:int y:int) (f x (f x y)))
    (doTwice + 5 "hi"))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f:(-> str str str) x:str y:str) (f x (f x y)))
    (doTwice + "Be" " Rhexa"))
  `;
  expectTypeError(program);
  program = `
  (let doTwice
    (lambda (f:(-> str str str) x:str y:str) (f x (f x y)))
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
    (lambda (n: int)
      (if (= n 0)
          1
          (* n (factorial (- n 1)))))
  `;
  let program = `(let factorial ${g} factorial)`;
  assertType(program, `(-> int int)`);
  program = `(let factorial ${g} (factorial 0))`;
  assertResult(program, `1`);
  program = `(let factorial ${g} (factorial 1))`;
  assertResult(program, `1`);
  program = `(let factorial ${g} (factorial 2))`;
  assertResult(program, `2`);
  program = `(let factorial ${g} (factorial 3))`;
  assertResult(program, `6`);
  program = `(let factorial ${g} (factorial 4))`;
  assertResult(program, `24`);
});

Deno.test("naive factorial (without type ann)", () => {
  const g = `
    (lambda (n)
      (if (= n 0)
          1
          (* n (factorial (- n 1)))))
  `;
  let program = `(let factorial ${g} factorial)`;
  assertType(program, `(-> int int)`);
  program = `(let factorial ${g} (factorial 0))`;
  assertType(program, "int");
  assertResult(program, `1`);
  program = `(let factorial ${g} (factorial 1))`;
  assertResult(program, `1`);
  program = `(let factorial ${g} (factorial 2))`;
  assertResult(program, `2`);
  program = `(let factorial ${g} (factorial 3))`;
  assertResult(program, `6`);
  program = `(let factorial ${g} (factorial 4))`;
  assertResult(program, `24`);
  program = `(let factorial ${g} (+ (factorial 4) (factorial 3)))`;
  assertResult(program, `30`);
});

Deno.test("recursive function that takes int returns str", () => {
  const g = `
    (lambda (n: int)
      (if (= n 0)
          ""
          (string-concat "a" (a-n-times (- n 1)))))
  `;
  let program = `(let a-n-times ${g} a-n-times)`;
  assertType(program, "(-> int str)");
  program = `(let a-n-times ${g} (a-n-times 0))`;
  assertType(program, "str");
  assertResult(program, `""`);
  program = `(let a-n-times ${g} (a-n-times 1))`;
  assertResult(program, `"a"`);
  program = `(let a-n-times ${g} (a-n-times 2))`;
  assertResult(program, `"aa"`);
  program = `(string-concat (let a-n-times ${g} (a-n-times 2)) "b")`;
  assertResult(program, `"aab"`);
});

Deno.test("naive fibonacci", () => {
  const g = `
    (lambda (n)
      (if (= n 0)
          0
          (if (= n 1)
            1
            (+ (fibonacci (- n 1)) (fibonacci (- n 2))))))
  `;
  let program = `(let fibonacci ${g} fibonacci)`;
  assertType(program, "(-> int int)");
  program = `(let fibonacci ${g} (fibonacci 0))`;
  assertType(program, "int");
  assertResult(program, `0`);
  program = `(let fibonacci ${g} (fibonacci 1))`;
  assertResult(program, `1`);
  program = `(let fibonacci ${g} (fibonacci 2))`;
  assertResult(program, `1`);
  program = `(let fibonacci ${g} (fibonacci 3))`;
  assertResult(program, `2`);
  program = `(let fibonacci ${g} (fibonacci 4))`;
  assertResult(program, `3`);
  program = `(let fibonacci ${g} (fibonacci 5))`;
  assertResult(program, `5`);
  // Naive algorithm too slow
  // program = `(let fibonacci ${g} (fibonacci 50))`;
  // assertResult(program, `12586269025`);
  program = `(let fibonacci ${g} (+ (fibonacci 5) (fibonacci 6)))`;
  assertType(program, "int");
  assertResult(program, `13`);
});

Deno.test("smart fibonacci", () => {
  let fib = (arg: number) => (`
    (let smart-fib
      (lambda (n)
          (let helper
            (lambda (i prev1 prev2)
                    (if (= i n)
                        prev2
                        (helper (+ i 1) (+ prev1 prev2) prev1)))
            (helper 0 1 0)))
      (smart-fib ${arg}))
  `);
  let program = fib(0);
  assertType(program, "int");
  assertResult(program, `0`);
  program = fib(1);
  assertResult(program, `1`);
  program = fib(2);
  assertResult(program, `1`);
  program = fib(3);
  assertResult(program, `2`);
  program = fib(4);
  assertResult(program, `3`);
  program = fib(5);
  assertResult(program, `5`);
  program = fib(50);
  assertResult(program, `12586269025`);
  program = fib(`"hi"` as any);
  expectTypeError(program);
});

Deno.test("identity fn", () => {
  let program = "(lambda (x) x)";
  assertType(program, "(-> 'a 'a)");
});

Deno.test("type inference on function", () => {
  let program = "(lambda (x y) (if x 0 1))";
  assertType(program, "(-> bool 'a int)");
});

Deno.test("type inference on functions with free types", () => {
  let program = "(lambda (x y) (if x y y))";
  assertType(program, "(-> bool 'a 'a)");
  program = "(lambda (x y z) (if x y z))";
  assertType(program, "(-> bool 'a 'a 'a)");
  program = "(lambda (x y z) (if x y y))";
  assertType(program, "(-> bool 'a 'b 'a)");
  program = "(lambda (x y z) (if x z z))";
  assertType(program, "(-> bool 'a 'b 'b)");
  program =
    "(lambda (x y z1 z2 z3 z4 z5 z6 z7 z8 z9 z10 z11 z12 z13 z14 z15) (if x 0 y))";
  assertType(
    program,
    "(-> bool int 'a 'b 'c 'd 'e 'f 'g 'h 'i 'j 'k 'l 'm 'n 'o int)",
  );
});

Deno.test("defining a variable (list)", () => {
  let program = `(let x (cons 1 (cons 2 (cons 3 empty))) x)`;
  assertType(program, `(Listof int)`);
  assertResult(program, `(cons 1 (cons 2 (cons 3 empty)))`);
});

Deno.test("defining a variable (nested list)", () => {
  let program =
    `(let x (cons (cons 1 (cons 3 empty)) (cons (cons 2 empty) empty)) x)`;
  assertType(program, `(Listof (Listof int))`);
  assertResult(
    program,
    `(cons (cons 1 (cons 3 empty)) (cons (cons 2 empty) empty))`,
  );
});

Deno.test("[TypeError] defining a variable (list)", () => {
  let program = `(let x (cons 1 (cons "hi" (cons 3 empty))) x)`;
  expectTypeError(program);
});

Deno.test("[TypeError] defining a variable (nested list)", () => {
  let program =
    `(let x (cons (cons 1 (cons 3 empty)) (cons (cons "hi" empty) empty)) x)`;
  expectTypeError(program);
});

Deno.test("accessing car of list", () => {
  let program = `(car (cons 1 (cons 2 empty)))`;
  assertType(program, `int`);
  assertResult(program, `1`);
});

Deno.test("accessing cdr of list", () => {
  let program = `(cdr (cons 1 (cons 2 empty)))`;
  assertType(program, `(Listof int)`);
  assertResult(program, `(cons 2 empty)`);
  program = `(cdr (cdr (cons 1 (cons 2 empty))))`;
  assertType(program, `(Listof int)`);
  assertResult(program, `empty`);
});

Deno.test("defining a function that takes a list (with type ann)", () => {
  let program = "(lambda (x:(Listof int)) x)";
  assertType(program, "(-> (Listof int) (Listof int))");
  program = `(lambda (x:(Listof int)) (car x))`;
  assertType(program, "(-> (Listof int) int)");
  program = `(lambda (x:(Listof int)) (cdr x))`;
  assertType(program, "(-> (Listof int) (Listof int))");
  program = `(lambda (x:(Listof int)) (+ 1 (car x)))`;
  assertType(program, "(-> (Listof int) int)");
});

Deno.test("defining a function that takes a list (without type ann)", () => {
  let program = "(lambda (x) (empty? x))";
  assertType(program, "(-> (Listof 'a) bool)");
  program = `(lambda (x) (car x))`;
  assertType(program, "(-> (Listof 'a) 'a)");
  program = `(lambda (x) (cdr x))`;
  assertType(program, "(-> (Listof 'a) (Listof 'a))");
  program = `(lambda (x) (+ 1 (car x)))`;
  assertType(program, "(-> (Listof int) int)");
});

Deno.test("calling a function that takes a list (with type ann)", () => {
  let program = "((lambda (x:(Listof int)) x) (cons 1 (cons 2 empty)))";
  assertType(program, "(Listof int)");
  assertResult(program, `(cons 1 (cons 2 empty))`);
  program = `((lambda (x:(Listof int)) (car x)) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, `1`);
  program = `((lambda (x:(Listof int)) (cdr x)) (cons 1 (cons 2 empty)))`;
  assertType(program, `(Listof int)`);
  assertResult(program, `(cons 2 empty)`);
  program =
    `((lambda (x:(Listof int)) (+ 41 (car x))) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, `42`);
});

Deno.test("calling a function that takes a list (without type ann)", () => {
  let program = "((lambda (x) x) (cons 1 (cons 2 empty)))";
  assertType(program, "(Listof int)");
  assertResult(program, `(cons 1 (cons 2 empty))`);
  program = `((lambda (x) (car x)) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, `1`);
  program = `((lambda (x) (cdr x)) (cons 1 (cons 2 empty)))`;
  assertType(program, `(Listof int)`);
  assertResult(program, `(cons 2 empty)`);
  program = `((lambda (x) (+ 41 (car x))) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, `42`);
});

Deno.test("[TypeError] calling a function that takes a list (with type ann)", () => {
  let program = `((lambda (x:(Listof int)) x) (cons "hi" (cons "bye" empty)))`;
  expectTypeError(program);
  program =
    `((lambda (x:(Listof int)) (string-concat (car x) "world")) (cons 1 (cons 2 empty)))`;
  expectTypeError(program);
});

Deno.test("[TypeError] calling a function that takes a list (without type ann)", () => {
  let program =
    `((lambda (x) (string-concat (car x) "world")) (cons 1 (cons 2 empty)))`;
  expectTypeError(program);
});

Deno.test("recursion with lists (without type ann)", () => {
  let g = (call: string) => (`
    (let map
      (lambda (f lst)
        (if (empty? lst)
          empty
          (cons (f (car lst)) (map f (cdr lst)))))
      ${call})
  `);
  let program = g(`map`);
  assertType(program, "(-> (-> 'a 'b) (Listof 'a) (Listof 'b))");
  program = g(`
  (let result (map (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))
      (if (empty? result) #f (car result)))
  `);
  assertType(program, "bool");
  program = g(`(map (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))`);
  assertType(program, "(Listof bool)");
  assertResult(program, `(cons #f (cons #t empty))`);
  program = g(`(map (lambda (n) (+ n 41)) (cons 1 (cons 2 empty)))`);
  assertType(program, "(Listof int)");
  assertResult(program, `(cons 42 (cons 43 empty))`);

  g = (call: string) => (`
    (let filter
      (lambda (f lst)
        (if (empty? lst)
          empty
          (if (f (car lst))
              (cons (car lst) (filter f (cdr lst)))
              (filter f (cdr lst)))))
      ${call})
  `);
  program = g(`filter`);
  assertType(program, "(-> (-> 'a bool) (Listof 'a) (Listof 'a))");
  program = g(`(filter (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))`);
  assertType(program, "(Listof int)");
  assertResult(program, `(cons 2 empty)`);

  g = (call: string) => (`
    (let any
      (lambda (f lst)
        (if (empty? lst)
          #f
          (if (f (car lst)) #t (any f (cdr lst)))))
      ${call})
  `);
  program = g(`any`);
  assertType(program, "(-> (-> 'a bool) (Listof 'a) bool)");
  program = g(`(any (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))`);
  assertType(program, "bool");
  assertResult(program, `#t`);
  program = g(`(any (lambda (n) (= n 3)) (cons 1 (cons 2 empty)))`);
  assertType(program, "bool");
  assertResult(program, `#f`);
});

Deno.test("defining a variable (record)", () => {
  let program = `(let x {a:1 d:(if #t "yes" "no") e:#f b:2 c:"hi"} x)`;
  assertType(program, `{a:int b:int c:str d:str e:bool}`);
  assertResult(program, `{a:1 b:2 c:"hi" d:"yes" e:#f}`);
});

Deno.test("nested record", () => {
  let program = `{a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}}`;
  assertType(program, `{a:int b:str z:{b:int c:str}}`);
  assertResult(program, `{a:1 b:"yes" z:{b:2 c:"hi"}}`);
});

Deno.test("accessing field in record", () => {
  let program = `(get-field {a:1 d:(if #t "yes" "no") e:#f b:2 c:"hi"} "a")`;
  assertType(program, `int`);
  assertResult(program, `1`);
});

Deno.test("[TypeError] accessing non-existent field in record", () => {
  let program = `(get-field {a:1 d:(if #t "yes" "no") e:#f b:2 c:"hi"} "aa")`;
  expectTypeError(program);
});

Deno.test("accessing nested field in nested record", () => {
  let program = `(get-field {a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}} "z")`;
  assertType(program, `{b:int c:str}`);
  assertResult(program, `{b:2 c:"hi"}`);
  program =
    `(get-field (get-field {a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}} "z") "c")`;
  assertType(program, `str`);
  assertResult(program, `"hi"`);
});

Deno.test("[TypeError] accessing nested field in nested record", () => {
  let program = `(get-field {a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}} "c")`;
  expectTypeError(program);
  program =
    `(get-field (get-field {a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}} "z") "a")`;
  expectTypeError(program);
});

Deno.test("defining a function that takes a record (with type ann)", () => {
  let program = "(lambda (x:{a:int b:str}) x)";
  assertType(program, "(-> {a:int b:str} {a:int b:str})");
  program = `(lambda (x:{a:int b:str}) (get-field x "a"))`;
  assertType(program, "(-> {a:int b:str} int)");
  program = `(lambda (x:{a:int b:str}) (get-field x "b"))`;
  assertType(program, "(-> {a:int b:str} str)");
});

Deno.test("defining a function that takes a record (without type ann)", () => {
  let program = "(lambda (x) x)";
  assertType(program, "(-> 'a 'a)");
  program = `(lambda (x) (get-field x "a"))`;
  assertType(program, "(-> {a:'a} 'a)");
  program = `(lambda (x) (get-field x "b"))`;
  assertType(program, "(-> {b:'a} 'a)");
});

Deno.test("calling a function that takes a record (with type ann)", () => {
  let program = `((lambda (x:{a:int b:str}) x) {a:7 b:"hi"})`;
  assertType(program, "{a:int b:str}");
  assertResult(program, `{a:7 b:"hi"}`);
  program = `((lambda (x:{a:int b:str}) (get-field x "a"))  {a:7 b:"hi"})`;
  assertType(program, "int");
  assertResult(program, `7`);
  program = `((lambda (x:{a:int b:str}) (get-field x "b")) {a:7 b:"hi"})`;
  assertType(program, "str");
  assertResult(program, `"hi"`);
});

Deno.test("calling a function that takes a record (without type ann)", () => {
  let program = `((lambda (x) x) {a:7 b:"hi"})`;
  assertType(program, "{a:int b:str}");
  assertResult(program, `{a:7 b:"hi"}`);
  program = `((lambda (x) (get-field x "a"))  {a:7 b:"hi"})`;
  assertType(program, "int");
  assertResult(program, `7`);
  program = `(+ 1 ((lambda (x) (get-field x "a"))  {a:7 b:"hi"}))`;
  assertType(program, "int");
  assertResult(program, `8`);
  program = `((lambda (x) (get-field x "b")) {a:7 b:"hi"})`;
  assertType(program, "str");
  assertResult(program, `"hi"`);
});

Deno.test("calling a function that takes a record with different shaped records", () => {
  let program = `
    (let get-a
      (lambda (x) (get-field x "a"))
      (+ (get-a {a:7 b:"hi"})
         (get-a {a:1 c:#f})))`;
  assertType(program, "int");
  assertResult(program, `8`);
});

Deno.test("calling two functions that take different shaped record with the same record", () => {
  let program = `
    (let x {a: 1 b:2 c:#t}
      (let get-a-b-sum
        (lambda (x) (+ (get-field x "a") (get-field x "b")))
          (let get-b-if-c
            (lambda (x) (if (get-field x "c") (get-field x "b") -1))
            (* (get-a-b-sum x) (get-b-if-c x)))))
  `;
  assertType(program, "int");
  assertResult(program, `6`);
});

Deno.test("[TypeError] calling a function that takes a record (with type ann)", () => {
  let program = `((lambda (x:{a:int b:str}) x) {a:7})`;
  expectTypeError(program);
  program = `((lambda (x:{a:int b:str}) (get-field x "a"))  {a:7})`;
  expectTypeError(program);
  program = `((lambda (x:{c:int}) (get-field x "a"))  {c:7})`;
  expectTypeError(program);
});

Deno.test("[TypeError] calling a function that takes a record (without type ann)", () => {
  let program = `((lambda (x) (get-field x "a"))  {c:7})`;
  expectTypeError(program);
});

Deno.test("record with field of list of records", () => {
  let program = `(car (cons {c:"hi" d:#f} empty))`;
  assertType(program, `{c:str d:bool}`);
  program = `(get-field {c:"hi" d:#f} "d")`;
  assertType(program, `bool`);
  program = `(get-field (car (cons {c:"hi" d:#f} empty)) "d")`;
  assertType(program, `bool`);

  program = `(lambda (x) (get-field (car x) "d"))`;
  assertType(program, `(-> (Listof {d:'a}) 'a)`);
  program = `((lambda (x) (get-field (car x) "d")) (cons {c:"hi" d:#f} empty))`;
  assertType(program, `bool`);
  assertResult(program, `#f`);

  program = `(lambda (x) (car (get-field (car x) "d")))`;
  assertType(program, `(-> (Listof {d:(Listof 'a)}) 'a)`);
  program =
    `((lambda (x) (get-field (car x) "d")) (cons {c:"hi" d:(cons #f empty)} empty))`;
  assertType(program, `(Listof bool)`);
  assertResult(program, `(cons #f empty)`);
  program =
    `((lambda (x) (car (get-field (car x) "d"))) (cons {c:"hi" d:(cons #f empty)} empty))`;
  assertType(program, `bool`);
  assertResult(program, `#f`);
});

Deno.test("[TypeError] record with field of list of records", () => {
  let program = `(get-field {c:"hi" d:#f} "a")`;
  expectTypeError(program);
  program = `(get-field (car (cons {c:"hi" d:#f} empty)) "a")`;
  expectTypeError(program);
  program = `((lambda (x) (get-field (car x) "d")) (cons {c:"hi"} empty))`;
  expectTypeError(program);

  program =
    `((lambda (x) (car (get-field (car x) "d"))) (cons {c:"hi" d:#f} empty))`;
  expectTypeError(program);
});

Deno.test("hamming distance", () => {
  let program = (str1: string, str2: string) => (`
    (let hamming-distance (lambda (s1 s2)
      (if (not (= (string-length s1) (string-length s2)))
          -1
          (let helper
            (lambda (l1 l2 acc)
              (if (empty? l1)
                  acc
                  (helper (cdr l1) (cdr l2) (if (= (car l1) (car l2)) acc (+ acc 1)))))
            (helper (string->list s1) (string->list s2) 0))))
      (hamming-distance "${str1}" "${str2}"))
  `);
  assertType(program("", ""), `int`);
  assertResult(program("", ""), `0`);
  assertResult(program("a", ""), `-1`);
  assertResult(program("a", "a"), `0`);
  assertResult(program("a", "b"), `1`);
  assertResult(program("ACCAGGG", "ACTATGG"), `2`);
  assertResult(program("hellothere", "yellowhair"), `5`);
});

Deno.test("ref", () => {
  let program = `
    (let x (ref 1)
      (begin
        (set-ref x 2)
        (get-ref x)))
  `;
  assertType(program, `int`);
  assertResult(program, `2`);
  program = `
    (let x (ref 1)
      (begin
        (set-ref x (+ (get-ref x) 1))
        (get-ref x)))
  `;
  assertType(program, `int`);
  assertResult(program, `2`);
});

Deno.test("[TypeError] ref", () => {
  let program = `
    (let x (ref 1)
      (begin
        (set-ref x #t)
        (get-ref x)))
  `;
  expectTypeError(program);
  program = `
    (let x (ref "hi")
      (begin
        (set-ref x (+ (get-ref x) 1))
        (get-ref x)))
  `;
  expectTypeError(program);
});

Deno.test("ref of record", () => {
  let program = `
    (let x (ref {a:1})
      (let set-a-to-2 (lambda (r) (set-ref r {a:2}))
        (begin
          (set-a-to-2 x)
          (get-ref x))))
  `;
  assertType(program, `{a:int}`);
  assertResult(program, `{a:2}`);
});

Deno.test("[TypeError] ref of record", () => {
  let program = `
    (let x (ref {a:1 b:"hi"})
      (let set-a-to-2 (lambda (r) (set-ref r {a:2}))
        (begin
          (set-a-to-2 x)
          (get-ref x))))
  `;
  expectTypeError(program);
});

Deno.test("function taking record ref", () => {
  let program = `
    (let x (ref {a:1 b:"hi"})
      (let get-a (lambda (r) (get-field (get-ref r) "a"))
        (get-a x)))
  `;
  assertType(program, `int`);
  assertResult(program, `1`);
});

Deno.test("function taking record ref and mutating", () => {
  let program = `
    (let x (ref {a:1 b:"hi"})
      (let set-a-to-2
        (lambda (r)
          (begin
            (set-ref r {a: 2 b:(get-field (get-ref r) "b")})
            r))
        (set-a-to-2 x)))
  `;
  assertType(program, `(ref {a:int b:str})`);
  assertResult(program, `(ref {a:2 b:"hi"})`);
  program = `
    (let x (ref {a:1 b:"bye"})
      (let set-a-to-2
        (lambda (r)
          (begin
            (set-ref r {a: 2 b:(get-field (get-ref r) "b")})
            r))
        (set-a-to-2 x)))
  `;
  assertType(program, `(ref {a:int b:str})`);
  assertResult(program, `(ref {a:2 b:"bye"})`);
});

Deno.test("[TypeError] function taking record ref and mutating", () => {
  // Leaves off b field when mutating. This is a problem as after the function
  // exits, x should still be of type (ref {a:int b:str})
  let program = `
    (let x (ref {a:1 b:"hi"})
      (let set-a-to-2
        (lambda (r)
          (begin
            (set-ref r {a: 2})
            r))
        (set-a-to-2 x)))
  `;
  expectTypeError(program);
});

Deno.test("list contains", () => {
  let program = `
    (let list-contains
      (lambda (lst val)
        (if (empty? lst)
            #f
            (if (= (car lst) val)
                #t
                (list-contains (cdr lst) val))))
      (list-contains (cons 1 empty) 2))
  `;
  assertType(program, `bool`);
  assertResult(program, `#f`);
  program = `
    (let list-contains
      (lambda (lst val)
        (if (empty? lst)
            #f
            (if (= (car lst) val)
                #t
                (list-contains (cdr lst) val))))
      (list-contains (cons 1 (cons 2 empty)) 2))
  `;
  assertType(program, `bool`);
  assertResult(program, `#t`);
});

Deno.test("Using ref to memoize last call", () => {
  let program = `
  (let list-contains
    (let last-call (ref {lst: empty val:1 result:#f})
      (let helper
        (lambda (lst val)
          (if (and (= lst (get-field (get-ref last-call) "lst"))
                  (= val (get-field (get-ref last-call) "val")))
              {result: (get-field (get-ref last-call) "result") cache-hit:#t}
              (if (empty? lst)
                (begin
                  (set-ref last-call {lst:lst val:val result:#f})
                  {result:#f cache-hit:#f})
                (if (= (car lst) val)
                    (begin
                      (set-ref last-call {lst:lst val:val result:#t})
                      {result:#t cache-hit:#f})
                    (helper (cdr lst) val)))))
          helper))
    (let my-list (cons 1 (cons 2 empty))
      (list-contains my-list 2)))
  `;
  assertType(program, `{cache-hit:bool result:bool}`);
  assertResult(program, `{cache-hit:#f result:#t}`);

  program = `
    (let list-contains
      (let last-call (ref {lst: empty val:1 result:#f})
        (let helper
          (lambda (lst val)
            (if (and (= lst (get-field (get-ref last-call) "lst"))
                    (= val (get-field (get-ref last-call) "val")))
                {result: (get-field (get-ref last-call) "result") cache-hit:#t}
                (if (empty? lst)
                  (begin
                    (set-ref last-call {lst:lst val:val result:#f})
                    {result:#f cache-hit:#f})
                  (if (= (car lst) val)
                      (begin
                        (set-ref last-call {lst:lst val:val result:#t})
                        {result:#t cache-hit:#f})
                      (helper (cdr lst) val)))))
            helper))
      (let my-list (cons 1 (cons 2 empty))
        (begin
          (list-contains my-list 2)
          (list-contains my-list 2))))
  `;
  assertType(program, `{cache-hit:bool result:bool}`);
  assertResult(program, `{cache-hit:#t result:#t}`);
});
