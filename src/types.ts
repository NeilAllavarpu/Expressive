export type Operator = {
  operator: OperatorType;
  left_bind: number;
  right_bind: number;
};

export enum OperatorType {
  Add = "+",
  And = "&&",
  Assignment = "=",
  Colon = ":",
  IndexRange = "..",
  Mult = "*",
  Or = "||",
  Semicolon = ";",
  Subtraction = "-",
}

export enum SemanticType {
  Comma = ",",
  LeftBrace = "{",
  RightBrace = "}",
  LeftBracket = "[",
  RightBracket = "]",
  LeftParen = "(",
  RightParen = ")",
  Ellipsis = "...",
}

export enum ValueType {
  Array = "array",
  Function = "function",
  Integer = "integer",
  String = "string",
  Variable = "variable",
}

export enum VariableType {
  arr = "arr",
  int = "int",
  str = "str",
  func = "func",
  UNDEF = "UNDEF_DNU",
}

export enum MiscType {
  Indexing = "indexing",
  Invocation = "invocation",
  Spread = "spread",
}

export type TokenType = OperatorType | SemanticType | ValueType | VariableType;

export type IntegerToken = {
  type: ValueType.Integer;
  integer: number;
};

export type StringToken = {
  type: ValueType.String;
  string: string;
};

export type VariableToken = {
  type: ValueType.Variable;
  label: string;
};

export type Token =
  | IntegerToken
  | StringToken
  | VariableToken
  | {
      type: Exclude<TokenType, ValueType>;
    };

export type ExpressionType = OperatorType | ValueType | VariableType;

export type IntegerExpression = {
  type: ValueType.Integer;
  value: number;
  value_type: VariableType.int;
};

export type StringExpression = {
  type: ValueType.String;
  index: number;
  string: string;
  value_type: VariableType.str;
};

export type ArrayExpression = {
  type: ValueType.Array;
  arguments: Expression[][];
  value_type: VariableType.arr;
  used_registers?: Record<number, string>;
};

export type VariableExpression = {
  type: ValueType.Variable;
  register?: number;
  evict?: string | null;
  label: string;
  value_type: VariableType;
};

export type ArrayTypeExpression = {
  type: VariableType.arr;
  value_type: VariableType.arr;
  of: TypeExpression;
};

export type PrimitiveTypeExpression = {
  type: Exclude<VariableType, VariableType.arr>;
  value_type: Exclude<VariableType, VariableType.arr>;
};

export type TypeExpression = ArrayTypeExpression | PrimitiveTypeExpression;

export type AssignmentExpression = {
  type: OperatorType.Assignment;
  variable: VariableExpression;
  value: Expression[];
  value_type: VariableType;
};

export type DeclarationExpression = {
  type: OperatorType.Colon;
  variable: VariableExpression;
  variable_type: TypeExpression;
  value_type: VariableType;
};

export type FunctionExpression = {
  type: ValueType.Function;
  func: number;
  value_type: VariableType.func;
  used_registers?: Record<number, string>;
};

export type RegisterMap = Record<number, null | string>;
export type InvocationExpression = {
  type: MiscType.Invocation;
  func: Expression[];
  arguments: Expression[][];
  is_tail_call: boolean;
  value_type: VariableType;
  used_registers?: Record<number, string>;
};

export type IndexingExpression = {
  type: MiscType.Indexing;
  array: Expression[];
  index: Expression[];
  value_type: VariableType;
};

export type IndexingRangeExpression = {
  type: OperatorType.IndexRange;
  array: Expression[];
  index_lo: Expression[];
  index_hi: Expression[];
  value_type: VariableType;
};

export type SpreadExpression = {
  type: MiscType.Spread;
  array: Expression[];
  value_type: VariableType;
};

type SpecificTypes =
  | OperatorType.Assignment
  | OperatorType.Colon
  | OperatorType.IndexRange;

export type ValueExpression =
  | IntegerExpression
  | StringExpression
  | FunctionExpression
  | ArrayExpression;

export type BinaryExpression = {
  type: Exclude<OperatorType, SpecificTypes>;
  arguments: Expression[][];
  value_type: VariableType;
};

export type Expression =
  | ValueExpression
  | VariableExpression
  | TypeExpression
  | AssignmentExpression
  | DeclarationExpression
  | InvocationExpression
  | IndexingExpression
  | IndexingRangeExpression
  | SpreadExpression
  | BinaryExpression;

export type VariableInfo = {
  index: number;
  type: VariableType;
  captured: boolean;
};

export type Func = {
  body: Expression[];
  index: number;
  variables: Record<string, VariableInfo>;
  num_variables: number;
  bound: string[];
  parameters: VariableExpression[];
};

export type Prog = {
  functions: Record<number, Func>;
  strings: Record<string, number>;
};
