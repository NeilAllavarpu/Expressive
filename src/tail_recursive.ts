import { Expression, Func, MiscType, OperatorType } from "./types";

export const apply_tail_recursion_inner = (expr: Expression) => {
  if (expr.type === MiscType.Invocation) {
    expr.is_tail_call = true;
  }
  if (expr.type === OperatorType.And || expr.type === OperatorType.Or) {
    apply_tail_recursion_inner(expr.arguments[0].at(-1) as Expression);
    apply_tail_recursion_inner(expr.arguments[1].at(-1) as Expression);
  }
};

export const apply_tail_recursion = (func: Func) => {
  if (func.body.length > 0) {
    apply_tail_recursion_inner(func.body.at(-1) as Expression);
  }
};
