import { Operator, VariableInfo, VariableType } from "./types";
import { OperatorType } from "./types";

export const OperatorMap: Record<OperatorType, Operator> = {
  [OperatorType.Add]: {
    assembly: "add  x0, x0, x1\n",
    left_bind: 23,
    operator: OperatorType.Add,
    right_bind: 24,
  },
  [OperatorType.Subtraction]: {
    assembly: "sub  x0, x0, x1\n",
    left_bind: 23,
    operator: OperatorType.Subtraction,
    right_bind: 24,
  },
  [OperatorType.Mult]: {
    assembly: "mul  x0, x0, x1\n",
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
};

export const standard_vars: Record<string, VariableInfo> = {
  print: {
    captured: true,
    index: -1,
    type: VariableType.func,
  },
  return: {
    captured: true,
    index: -2,
    type: VariableType.func,
  },
};

export const breaking_operators = [OperatorType.Semicolon, OperatorType.And];
