import { ComparisonType, Operator, VariableInfo, VariableType } from "./types";
import { OperatorType } from "./types";

export const OperatorMap: Record<OperatorType, Operator> = {
  [OperatorType.Add]: {
    left_bind: 23,
    operator: OperatorType.Add,
    right_bind: 24,
  },
  [OperatorType.Subtraction]: {
    left_bind: 23,
    operator: OperatorType.Subtraction,
    right_bind: 24,
  },
  [OperatorType.Mult]: {
    left_bind: 25,
    operator: OperatorType.Mult,
    right_bind: 26,
  },
  [OperatorType.Division]: {
    left_bind: 25,
    operator: OperatorType.Division,
    right_bind: 26,
  },
  [OperatorType.Modulus]: {
    left_bind: 25,
    operator: OperatorType.Modulus,
    right_bind: 26,
  },
  [OperatorType.LeftShift]: {
    left_bind: 21,
    operator: OperatorType.LeftShift,
    right_bind: 22,
  },
  [OperatorType.RightShiftArithmetic]: {
    left_bind: 21,
    operator: OperatorType.RightShiftArithmetic,
    right_bind: 22,
  },
  [OperatorType.RightShiftLogical]: {
    left_bind: 21,
    operator: OperatorType.RightShiftLogical,
    right_bind: 22,
  },
  [OperatorType.Colon]: {
    left_bind: 30,
    operator: OperatorType.Colon,
    right_bind: 31,
  },
  [OperatorType.Semicolon]: {
    left_bind: 1,
    operator: OperatorType.Semicolon,
    right_bind: 2,
  },
  [OperatorType.Assignment]: {
    left_bind: 3,
    operator: OperatorType.Assignment,
    right_bind: 4,
  },
  [OperatorType.And]: {
    left_bind: 5,
    operator: OperatorType.And,
    right_bind: 6,
  },
  [OperatorType.Or]: {
    left_bind: 5,
    operator: OperatorType.Or,
    right_bind: 6,
  },
  [OperatorType.IndexRange]: {
    left_bind: 3,
    operator: OperatorType.IndexRange,
    right_bind: 4,
  },
  [OperatorType.Equal]: {
    left_bind: 7,
    operator: OperatorType.Equal,
    right_bind: 8,
  },
  [OperatorType.Unequal]: {
    left_bind: 7,
    operator: OperatorType.Unequal,
    right_bind: 8,
  },
  [OperatorType.Greater]: {
    left_bind: 7,
    operator: OperatorType.Greater,
    right_bind: 8,
  },
  [OperatorType.GreaterEqual]: {
    left_bind: 7,
    operator: OperatorType.GreaterEqual,
    right_bind: 8,
  },
  [OperatorType.Less]: {
    left_bind: 7,
    operator: OperatorType.Less,
    right_bind: 8,
  },
  [OperatorType.LessEqual]: {
    left_bind: 7,
    operator: OperatorType.LessEqual,
    right_bind: 8,
  },
};

export const standard_vars: Record<string, VariableInfo> = {
  length: {
    captured: true,
    index: -2,
    type: VariableType.func,
  },
  print: {
    captured: true,
    index: -1,
    type: VariableType.func,
  },
  read_int: {
    captured: true,
    index: -3,
    type: VariableType.func,
  },
};

export const breaking_operators = [
  OperatorType.Semicolon,
  OperatorType.And,
  OperatorType.Or,
];

export const ComparisonHints: Record<ComparisonType, string> = {
  [OperatorType.Equal]: "eq",
  [OperatorType.Unequal]: "ne",
  [OperatorType.Greater]: "gt",
  [OperatorType.GreaterEqual]: "ge",
  [OperatorType.Less]: "lt",
  [OperatorType.LessEqual]: "le",
};
