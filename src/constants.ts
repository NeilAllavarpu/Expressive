import { Operator, VariableInfo, VariableType } from "./types";
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
};

export const breaking_operators = [
  OperatorType.Semicolon,
  OperatorType.And,
  OperatorType.Or,
];
