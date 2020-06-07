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
  function valuesEqual(
    v1: ReturnType<typeof evaluate>,
    v2: ReturnType<typeof evaluate>,
  ): boolean {
    switch (v1.tag) {
      case "TmBool":
        return v2.tag === "TmBool" && v1.val === v2.val;
      case "TmInt":
        return v2.tag === "TmInt" && v1.val === v2.val;
      case "TmStr":
        return v2.tag === "TmStr" && v1.val === v2.val;
      case "TmEmpty":
        return v2.tag === "TmEmpty";
      case "TmCons":
        return v2.tag === "TmCons" &&
          valuesEqual(v1.car, v2.car) &&
          valuesEqual(v1.cdr, v2.cdr);
      case "TmRecord":
        return v2.tag === "TmRecord" &&
          Object.keys(v1.fields).length === Object.keys(v2.fields).length &&
          Object.keys(v1.fields).every((k) =>
            v2.fields[k] !== undefined &&
            valuesEqual(v1.fields[k], v2.fields[k])
          );
      case "TmStdlibFun":
      case "TmClosure":
        return false; // TODO ?
      default: {
        const _exhaustiveCheck: never = v1;
        throw new Error();
      }
    }
  }
  const success = valuesEqual(actualResult, expectedResult);
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
    (lambda (n: int)
      (if (= n 0)
          1
          (* n (factorial (- n 1)))))
  `;
  let program = `(let factorial ${g} factorial)`;
  assertType(program, `(-> (int) int)`);
  program = `(let factorial ${g} (factorial 0))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial ${g} (factorial 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial ${g} (factorial 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let factorial ${g} (factorial 3))`;
  assertResult(program, { tag: "TmInt", val: 6 });
  program = `(let factorial ${g} (factorial 4))`;
  assertResult(program, { tag: "TmInt", val: 24 });
});

Deno.test("naive factorial (without type ann)", () => {
  const g = `
    (lambda (n)
      (if (= n 0)
          1
          (* n (factorial (- n 1)))))
  `;
  let program = `(let factorial ${g} factorial)`;
  assertType(program, `(-> (int) int)`);
  program = `(let factorial ${g} (factorial 0))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial ${g} (factorial 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let factorial ${g} (factorial 2))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let factorial ${g} (factorial 3))`;
  assertResult(program, { tag: "TmInt", val: 6 });
  program = `(let factorial ${g} (factorial 4))`;
  assertResult(program, { tag: "TmInt", val: 24 });
  program = `(let factorial ${g} (+ (factorial 4) (factorial 3)))`;
  assertResult(program, { tag: "TmInt", val: 30 });
});

Deno.test("recursive function that takes int returns str", () => {
  const g = `
    (lambda (n: int)
      (if (= n 0)
          ""
          (string-concat "a" (a-n-times (- n 1)))))
  `;
  let program = `(let a-n-times ${g} a-n-times)`;
  assertType(program, "(-> (int) str)");
  program = `(let a-n-times ${g} (a-n-times 0))`;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "" });
  program = `(let a-n-times ${g} (a-n-times 1))`;
  assertResult(program, { tag: "TmStr", val: "a" });
  program = `(let a-n-times ${g} (a-n-times 2))`;
  assertResult(program, { tag: "TmStr", val: "aa" });
  program = `(string-concat (let a-n-times ${g} (a-n-times 2)) "b")`;
  assertResult(program, { tag: "TmStr", val: "aab" });
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
  assertType(program, "(-> (int) int)");
  program = `(let fibonacci ${g} (fibonacci 0))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 0 });
  program = `(let fibonacci ${g} (fibonacci 1))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let fibonacci ${g} (fibonacci 2))`;
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `(let fibonacci ${g} (fibonacci 3))`;
  assertResult(program, { tag: "TmInt", val: 2 });
  program = `(let fibonacci ${g} (fibonacci 4))`;
  assertResult(program, { tag: "TmInt", val: 3 });
  program = `(let fibonacci ${g} (fibonacci 5))`;
  assertResult(program, { tag: "TmInt", val: 5 });
  // Naive algorithm too slow
  // program = `(let fibonacci ${g} (fibonacci 50))`;
  // assertResult(program, { tag: "TmInt", val: 12586269025 });
  program = `(let fibonacci ${g} (+ (fibonacci 5) (fibonacci 6)))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 13 });
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
  assertResult(program, { tag: "TmInt", val: 0 });
  program = fib(1);
  assertResult(program, { tag: "TmInt", val: 1 });
  program = fib(2);
  assertResult(program, { tag: "TmInt", val: 1 });
  program = fib(3);
  assertResult(program, { tag: "TmInt", val: 2 });
  program = fib(4);
  assertResult(program, { tag: "TmInt", val: 3 });
  program = fib(5);
  assertResult(program, { tag: "TmInt", val: 5 });
  program = fib(50);
  assertResult(program, { tag: "TmInt", val: 12586269025 });
  program = fib(`"hi"` as any);
  expectTypeError(program);
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

Deno.test("defining a variable (list)", () => {
  let program = `(let x (cons 1 (cons 2 (cons 3 empty))) x)`;
  assertType(program, `(Listof int)`);
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmInt", val: 1 },
      cdr: {
        tag: "TmCons",
        car: { tag: "TmInt", val: 2 },
        cdr: {
          tag: "TmCons",
          car: { tag: "TmInt", val: 3 },
          cdr: { tag: "TmEmpty" },
        },
      },
    },
  );
});

Deno.test("defining a variable (nested list)", () => {
  let program =
    `(let x (cons (cons 1 (cons 3 empty)) (cons (cons 2 empty) empty)) x)`;
  assertType(program, `(Listof (Listof int))`);
  assertResult(
    program,
    {
      tag: "TmCons",
      car: {
        tag: "TmCons",
        car: { tag: "TmInt", val: 1 },
        cdr: {
          tag: "TmCons",
          car: { tag: "TmInt", val: 3 },
          cdr: { tag: "TmEmpty" },
        },
      },
      cdr: {
        tag: "TmCons",
        car: {
          tag: "TmCons",
          car: { tag: "TmInt", val: 2 },
          cdr: { tag: "TmEmpty" },
        },
        cdr: { tag: "TmEmpty" },
      },
    },
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
  assertResult(program, { tag: "TmInt", val: 1 });
});

Deno.test("accessing cdr of list", () => {
  let program = `(cdr (cons 1 (cons 2 empty)))`;
  assertType(program, `(Listof int)`);
  assertResult(
    program,
    { tag: "TmCons", car: { tag: "TmInt", val: 2 }, cdr: { tag: "TmEmpty" } },
  );
  program = `(cdr (cdr (cons 1 (cons 2 empty))))`;
  assertType(program, `(Listof int)`);
  assertResult(program, { tag: "TmEmpty" });
});

Deno.test("defining a function that takes a list (with type ann)", () => {
  let program = "(lambda (x:(Listof int)) x)";
  assertType(program, "(-> ((Listof int)) (Listof int))");
  program = `(lambda (x:(Listof int)) (car x))`;
  assertType(program, "(-> ((Listof int)) int)");
  program = `(lambda (x:(Listof int)) (cdr x))`;
  assertType(program, "(-> ((Listof int)) (Listof int))");
  program = `(lambda (x:(Listof int)) (+ 1 (car x)))`;
  assertType(program, "(-> ((Listof int)) int)");
});

Deno.test("defining a function that takes a list (without type ann)", () => {
  let program = "(lambda (x) (empty? x))";
  assertType(program, "(-> ((Listof 'a)) bool)");
  program = `(lambda (x) (car x))`;
  assertType(program, "(-> ((Listof 'a)) 'a)");
  program = `(lambda (x) (cdr x))`;
  assertType(program, "(-> ((Listof 'a)) (Listof 'a))");
  program = `(lambda (x) (+ 1 (car x)))`;
  assertType(program, "(-> ((Listof int)) int)");
});

Deno.test("calling a function that takes a list (with type ann)", () => {
  let program = "((lambda (x:(Listof int)) x) (cons 1 (cons 2 empty)))";
  assertType(program, "(Listof int)");
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmInt", val: 1 },
      cdr: {
        tag: "TmCons",
        car: { tag: "TmInt", val: 2 },
        cdr: { tag: "TmEmpty" },
      },
    },
  );
  program = `((lambda (x:(Listof int)) (car x)) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `((lambda (x:(Listof int)) (cdr x)) (cons 1 (cons 2 empty)))`;
  assertType(program, `(Listof int)`);
  assertResult(
    program,
    { tag: "TmCons", car: { tag: "TmInt", val: 2 }, cdr: { tag: "TmEmpty" } },
  );
  program =
    `((lambda (x:(Listof int)) (+ 41 (car x))) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 42 });
});

Deno.test("calling a function that takes a list (without type ann)", () => {
  let program = "((lambda (x) x) (cons 1 (cons 2 empty)))";
  assertType(program, "(Listof int)");
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmInt", val: 1 },
      cdr: {
        tag: "TmCons",
        car: { tag: "TmInt", val: 2 },
        cdr: { tag: "TmEmpty" },
      },
    },
  );
  program = `((lambda (x) (car x)) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 1 });
  program = `((lambda (x) (cdr x)) (cons 1 (cons 2 empty)))`;
  assertType(program, `(Listof int)`);
  assertResult(
    program,
    { tag: "TmCons", car: { tag: "TmInt", val: 2 }, cdr: { tag: "TmEmpty" } },
  );
  program = `((lambda (x) (+ 41 (car x))) (cons 1 (cons 2 empty)))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 42 });
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
  assertType(program, "(-> ((-> ('a) 'b) (Listof 'a)) (Listof 'b))");
  program = g(`
  (let result (map (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))
      (if (empty? result) #f (car result)))
  `);
  assertType(program, "bool");
  program = g(`(map (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))`);
  assertType(program, "(Listof bool)");
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmBool", val: false },
      cdr: {
        tag: "TmCons",
        car: { tag: "TmBool", val: true },
        cdr: { tag: "TmEmpty" },
      },
    },
  );
  program = g(`(map (lambda (n) (+ n 41)) (cons 1 (cons 2 empty)))`);
  assertType(program, "(Listof int)");
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmInt", val: 42 },
      cdr: {
        tag: "TmCons",
        car: { tag: "TmInt", val: 43 },
        cdr: { tag: "TmEmpty" },
      },
    },
  );

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
  assertType(program, "(-> ((-> ('a) bool) (Listof 'a)) (Listof 'a))");
  program = g(`(filter (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))`);
  assertType(program, "(Listof int)");
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmInt", val: 2 },
      cdr: { tag: "TmEmpty" },
    },
  );

  g = (call: string) => (`
    (let any
      (lambda (f lst)
        (if (empty? lst)
          #f
          (if (f (car lst)) #t (any f (cdr lst)))))
      ${call})
  `);
  program = g(`any`);
  assertType(program, "(-> ((-> ('a) bool) (Listof 'a)) bool)");
  program = g(`(any (lambda (n) (= n 2)) (cons 1 (cons 2 empty)))`);
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: true });
  program = g(`(any (lambda (n) (= n 3)) (cons 1 (cons 2 empty)))`);
  assertType(program, "bool");
  assertResult(program, { tag: "TmBool", val: false });
});

Deno.test("defining a variable (record)", () => {
  let program = `(let x {a:1 d:(if #t "yes" "no") e:#f b:2 c:"hi"} x)`;
  assertType(program, `{a:int b:int c:str d:str e:bool}`);
  assertResult(
    program,
    {
      tag: "TmRecord",
      fields: {
        a: { tag: "TmInt", val: 1 },
        b: { tag: "TmInt", val: 2 },
        c: { tag: "TmStr", val: "hi" },
        d: { tag: "TmStr", val: "yes" },
        e: { tag: "TmBool", val: false },
      },
    },
  );
});

Deno.test("nested record", () => {
  let program = `{a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}}`;
  assertType(program, `{a:int b:str z:{b:int c:str}}`);
  assertResult(
    program,
    {
      tag: "TmRecord",
      fields: {
        a: { tag: "TmInt", val: 1 },
        b: { tag: "TmStr", val: "yes" },
        z: {
          tag: "TmRecord",
          fields: {
            b: { tag: "TmInt", val: 2 },
            c: { tag: "TmStr", val: "hi" },
          },
        },
      },
    },
  );
});

Deno.test("accessing field in record", () => {
  let program = `(get-field {a:1 d:(if #t "yes" "no") e:#f b:2 c:"hi"} "a")`;
  assertType(program, `int`);
  assertResult(program, { tag: "TmInt", val: 1 });
});

Deno.test("[TypeError] accessing non-existent field in record", () => {
  let program = `(get-field {a:1 d:(if #t "yes" "no") e:#f b:2 c:"hi"} "aa")`;
  expectTypeError(program);
});

Deno.test("accessing nested field in nested record", () => {
  let program = `(get-field {a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}} "z")`;
  assertType(program, `{b:int c:str}`);
  assertResult(
    program,
    {
      tag: "TmRecord",
      fields: {
        b: { tag: "TmInt", val: 2 },
        c: { tag: "TmStr", val: "hi" },
      },
    },
  );
  program =
    `(get-field (get-field {a:1 b:(if #t "yes" "no") z: {b:2 c:"hi"}} "z") "c")`;
  assertType(program, `str`);
  assertResult(program, { tag: "TmStr", val: "hi" });
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
  assertType(program, "(-> ({a:int b:str}) {a:int b:str})");
  program = `(lambda (x:{a:int b:str}) (get-field x "a"))`;
  assertType(program, "(-> ({a:int b:str}) int)");
  program = `(lambda (x:{a:int b:str}) (get-field x "b"))`;
  assertType(program, "(-> ({a:int b:str}) str)");
});

Deno.test("defining a function that takes a record (without type ann)", () => {
  let program = "(lambda (x) x)";
  assertType(program, "(-> ('a) 'a)");
  program = `(lambda (x) (get-field x "a"))`;
  assertType(program, "(-> ({a:'a}) 'a)");
  program = `(lambda (x) (get-field x "b"))`;
  assertType(program, "(-> ({b:'a}) 'a)");
});

Deno.test("calling a function that takes a record (with type ann)", () => {
  let program = `((lambda (x:{a:int b:str}) x) {a:7 b:"hi"})`;
  assertType(program, "{a:int b:str}");
  assertResult(
    program,
    {
      tag: "TmRecord",
      fields: { a: { tag: "TmInt", val: 7 }, b: { tag: "TmStr", val: "hi" } },
    },
  );
  program = `((lambda (x:{a:int b:str}) (get-field x "a"))  {a:7 b:"hi"})`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 7 });
  program = `((lambda (x:{a:int b:str}) (get-field x "b")) {a:7 b:"hi"})`;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "hi" });
});

Deno.test("calling a function that takes a record (without type ann)", () => {
  let program = `((lambda (x) x) {a:7 b:"hi"})`;
  assertType(program, "{a:int b:str}");
  assertResult(
    program,
    {
      tag: "TmRecord",
      fields: { a: { tag: "TmInt", val: 7 }, b: { tag: "TmStr", val: "hi" } },
    },
  );
  program = `((lambda (x) (get-field x "a"))  {a:7 b:"hi"})`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 7 });
  program = `(+ 1 ((lambda (x) (get-field x "a"))  {a:7 b:"hi"}))`;
  assertType(program, "int");
  assertResult(program, { tag: "TmInt", val: 8 });
  program = `((lambda (x) (get-field x "b")) {a:7 b:"hi"})`;
  assertType(program, "str");
  assertResult(program, { tag: "TmStr", val: "hi" });
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
  assertType(program, `(-> ((Listof {d:'a})) 'a)`);
  program = `((lambda (x) (get-field (car x) "d")) (cons {c:"hi" d:#f} empty))`;
  assertType(program, `bool`);
  assertResult(program, { tag: "TmBool", val: false });

  program = `(lambda (x) (car (get-field (car x) "d")))`;
  assertType(program, `(-> ((Listof {d:(Listof 'a)})) 'a)`);
  program =
    `((lambda (x) (get-field (car x) "d")) (cons {c:"hi" d:(cons #f empty)} empty))`;
  assertType(program, `(Listof bool)`);
  assertResult(
    program,
    {
      tag: "TmCons",
      car: { tag: "TmBool", val: false },
      cdr: { tag: "TmEmpty" },
    },
  );
  program =
    `((lambda (x) (car (get-field (car x) "d"))) (cons {c:"hi" d:(cons #f empty)} empty))`;
  assertType(program, `bool`);
  assertResult(program, { tag: "TmBool", val: false });
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
