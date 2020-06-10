import { createLexer } from "./lexer.ts";
import { createAST } from "./parser.ts";
import { evaluate } from "./interpreter.ts";
import { printError, printValue } from "./utils.ts";
import { MyPLError } from "./exceptions.ts";
import { typeCheck } from "./typechecker.ts";
import { existsSync } from "https://deno.land/std/fs/exists.ts";
import { readFileStrSync } from "https://deno.land/std/fs/read_file_str.ts";

function executeProgram(program: string) {
  try {
    const lexer = createLexer(program);
    const ast = createAST(lexer);
    const _ = typeCheck(ast);
    console.log(printValue((evaluate(ast))));
  } catch (e) {
    if (e instanceof MyPLError) {
      console.log(printError(program, e));
    } else {
      throw e;
    }
  }
}

function main() {
  const args = Deno.args;
  if (args.length !== 1) {
    console.error("Usage: pass file name of file to run");
    return;
  }
  const sourceFile = args[0];
  if (!existsSync(sourceFile)) {
    console.error(`File not found: ${sourceFile}`);
  }
  const program = readFileStrSync(sourceFile);
  executeProgram(program);
}

main();
