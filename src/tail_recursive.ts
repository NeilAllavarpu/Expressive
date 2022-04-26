import { Expression, Func, MiscType, OperatorType } from "./types";
import { last_element } from "./utils";

export const get_last_computation = (expr: Expression): Expression => {
  if (expr.type === OperatorType.And) {
    return get_last_computation(last_element(expr.arguments[1]));
  }

  return expr;
};

export const apply_tail_recursion = (func: Func) => {
  const return_expression = get_last_computation(
    func.body[func.body.length - 1]
  );
  if (return_expression.type === MiscType.Invocation) {
    return_expression.is_tail_call = true;
  }
};
