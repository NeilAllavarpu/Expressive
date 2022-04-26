export type Operator = {
  assembly?: string;
  operator: OperatorType;
  left_bind: number;
  right_bind: number;
};

export enum OperatorType {
  Add = "+",
  Assignment = "=",
  Colon = ":",
  Mult = "*",
  Semicolon = ";",
  Subtraction = "-",
  And = "&&",
}

export enum SemanticType {
  LeftParen = "(",
  RightParen = ")",
  LeftBrace = "{",
  RightBrace = "}",
  Comma = ",",
}

export enum ValueType {
  Integer = "integer",
  String = "string",
  Variable = "variable",
  Function = "function",
}

export enum VariableType {
  int = "int",
  str = "str",
  func = "func",
  UNDEF = "UNDEF_DNU",
}

export enum MiscType {
  Invocation = "invocation",
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
export type Token = IntegerToken | StringToken | VariableToken | {
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
export type VariableExpression = {
  type: ValueType.Variable;
  label: string;
  value_type: VariableType;
};
export type TypeExpression = {
  type: VariableType;
  value_type: VariableType;
};
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
};
export type InvocationExpression = {
  type: MiscType.Invocation;
  func: Expression[];
  arguments: Expression[][];
  value_type: VariableType;
};
type SpecificTypes = OperatorType.Assignment | OperatorType.Colon;
export type BinaryExpression = {
  type: Exclude<OperatorType, SpecificTypes>;
  arguments: Expression[][];
  value_type: VariableType;
};

export type Expression =
  | IntegerExpression
  | StringExpression
  | VariableExpression
  | TypeExpression
  | AssignmentExpression
  | DeclarationExpression
  | FunctionExpression
  | InvocationExpression
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
