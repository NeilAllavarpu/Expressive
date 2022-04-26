import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  ValueType,
  VariableType,
} from "./types";

const breaking_operators = [OperatorType.Semicolon, OperatorType.And];

export const typify_arr = (
  expression_sequence: Expression[],
  variables: Func["variables"]
) => {
  expression_sequence.forEach((expression) => {
    typify(expression, variables);
  });
};

const last_elem = <T>(array: T[]) => array[array.length - 1];

const typify = (expression: Expression, variables: Func["variables"]) => {
  switch (expression.type) {
    case ValueType.String:
    case ValueType.Integer:
    case VariableType.str:
    case VariableType.int:
    case VariableType.func:
    case VariableType.UNDEF:
      break;
    case OperatorType.Colon:
      variables[expression.variable.label].type = expression.variable_type.type;
      break;
    case ValueType.Function:
      expression.value_type = VariableType.func;
      break;
    case OperatorType.Assignment:
      typify(expression.variable, variables);
      typify_arr(expression.value, variables);
      if (
        expression.variable.value_type !==
        last_elem(expression.value).value_type
      ) {
        throw TypeError(
          "Type of variable does not match type of expression in assignment!"
        );
      }
      expression.value_type = expression.variable.value_type;
      break;
    case ValueType.Variable:
      expression.value_type = variables[expression.label].type;
      break;
    case MiscType.Invocation: {
      typify_arr(expression.func, variables);
      if (last_elem(expression.func).value_type !== VariableType.func) {
        throw TypeError("Non-function attempting to be invoked!");
      }
      expression.arguments.forEach((expr) => {
        typify_arr(expr, variables);
      });
      break;
    }
    default: {
      expression.arguments.forEach((expr) => {
        typify_arr(expr, variables);
      });
      const expression_type = last_elem(expression.arguments[0]).value_type;
      if (
        !breaking_operators.includes(expression.type) &&
        !expression.arguments
          .map(last_elem)
          .every(({ value_type }) => value_type === expression_type)
      ) {
        throw TypeError("ERROR: mismatch of types in operation!");
      }
      expression.value_type = expression_type;
    }
  }
};
