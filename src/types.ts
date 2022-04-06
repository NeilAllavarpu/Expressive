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
}

export enum SemanticType {
  LeftParen = "(",
  RightParen = ")",
  LeftBrace = "{",
  RightBrace = "}",
  Comma = ",",
}

export enum ValueType {
  Literal = "literal",
  Variable = "variable",
}

export enum VariableType {
  ui64 = "ui64",
}

export enum MiscType {
  Function = "function",
  Invocation = "invocation",
}

export type TokenType = OperatorType | SemanticType | ValueType | VariableType;

export type LiteralToken = {
  type: ValueType.Literal;
  value: number;
};
export type VariableToken = {
  type: ValueType.Variable;
  label: string;
};
export type Token = LiteralToken | VariableToken | {
  type: Exclude<TokenType, ValueType>;
};

export type ExpressionType = OperatorType | ValueType | VariableType;
export type LiteralExpression = {
  type: ValueType.Literal;
  value: number;
};
export type VariableExpression = {
  type: ValueType.Variable;
  index: number;
  label: string;
};
export type TypeExpression = {
  type: VariableType;
};
export type AssignmentExpression = {
  type: OperatorType.Assignment;
  variable: VariableExpression;
  value: Expression;
};
export type DeclarationExpression = {
  type: OperatorType.Colon;
  variable: VariableExpression;
  variable_type: TypeExpression;
};
export type FunctionExpression = {
  type: MiscType.Function;
  func: number;
};
export type InvocationExpression = {
  type: MiscType.Invocation;
  func: Expression;
  arguments: Expression[];
};
type SpecificTypes = OperatorType.Assignment | OperatorType.Colon;
export type BinaryExpression = {
  type: Exclude<OperatorType, SpecificTypes>;
  arguments: Expression[];
};

export type Expression = LiteralExpression | VariableExpression | TypeExpression | AssignmentExpression | DeclarationExpression | FunctionExpression | InvocationExpression | BinaryExpression;

export type Func = {
  body: Expression;
  index: number;
  num_variables: number;
  parameters: VariableExpression[];
};
