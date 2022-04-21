import { exit } from "process";
import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  ValueType,
  VariableType,
} from "./types";

export const typify = (
  expression: Expression,
  variables: Func["variables"]
) => {
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
      typify(expression.value, variables);
      if (expression.variable.value_type !== expression.value.value_type) {
        console.error(
          "ERROR: type of variable does not match type of expression in assignment!"
        );
        // exit(1);
      }
      expression.value_type = expression.variable.value_type;
      break;
    case ValueType.Variable:
      expression.value_type = variables[expression.label].type;
      break;
    case MiscType.Invocation: {
      typify(expression.func, variables);
      if (expression.func.value_type !== VariableType.func) {
        throw TypeError("Non-function attempting to be invoked!");
      }
      // fall through
    }
    default:
      expression.arguments.forEach((expr) => {
        typify(expr, variables);
      });
      if (
        expression.type !== OperatorType.Semicolon &&
        !expression.arguments.every(
          ({ value_type }) => value_type === expression.arguments[0].value_type
        )
      ) {
        throw TypeError("ERROR: mismatch of types in operation!");
      }
      if (expression.type !== MiscType.Invocation) {
        expression.value_type = expression.arguments[0].value_type;
      }
  }
};
