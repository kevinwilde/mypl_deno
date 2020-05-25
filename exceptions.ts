import { SourceInfo } from "./lexer.ts";

export abstract class MyPLError extends Error {
  public sourceInfo?: SourceInfo;
  constructor(msg: string, sourceInfo?: SourceInfo) {
    super(msg);
    this.name = "MyPLError";
    this.sourceInfo = sourceInfo;
  }
}

export class ParseError extends MyPLError {
  constructor(msg: string, sourceInfo: SourceInfo) {
    super(msg, sourceInfo);
    this.name = "ParseError";
  }
}

export class EOFError extends MyPLError {
  constructor() {
    super("Unexpected EOF");
    this.name = "EOFError";
  }
}

export class TypeError extends MyPLError {
  constructor(msg: string, sourceInfo: SourceInfo) {
    super(msg, sourceInfo);
    this.name = "TypeError";
  }
}

export class RuntimeError extends MyPLError {
  constructor(msg: string, sourceInfo: SourceInfo) {
    super(msg, sourceInfo);
    this.name = "RuntimeError";
  }
}
