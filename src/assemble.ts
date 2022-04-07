import {exit,} from "process";
import {OperatorMap,} from "./constants";
import {Expression, Func, MiscType, OperatorType, Prog, ValueType, VariableExpression, VariableInfo, VariableType,} from "./types";

const pop = (register = 0) => `ldr  x${register}, [sp], #16\n`;
const push = (register = 0) => `str  x${register}, [sp, #-16]!\n`;

const to_offset = (var_index: number) => -16 * (var_index + 1);

const assemble_expression = (expression: Expression, variable_map: Record<string, VariableInfo>, push_result = true): string => {
  const load_args = (args: Expression[]) => args.reduce(
    (assembly, expression, i, {length, },) =>
      assembly +
      assemble_expression(expression, variable_map, i != length - 1), ""
  ) + `mov  x${args.length - 1}, x0\n` +
    args.reduce((assembly, __, i, {length, }) =>
      (i == length - 1 ? "" : pop(i)) + assembly, ""
    );

  let string;
  switch (expression.type) {
    case ValueType.Integer:
      string = `ldr  x0, =${expression.value}\n`;
      break;
    case ValueType.String:
      string =`adrp  x0, string${expression.index}
add  x0, x0, #:lo12:string${expression.index}
`;
      break;
    case ValueType.Variable:
      string = `ldr  x0, [x29, #${to_offset(variable_map[expression.label].index)}]\n`;
      break;
    case VariableType.int:
    case VariableType.str:
    case VariableType.func:
    case VariableType.UNDEF:
      exit(1);
      break;
    case OperatorType.Assignment: {
      string = assemble_expression(expression.value, variable_map, false) + `str  x0, [x29, #${to_offset(variable_map[expression.variable.label].index)}]\n`;
      break;
    }
    case OperatorType.Colon:
      string = "";
      break;
    case OperatorType.Semicolon:
      string = assemble_expression(expression.arguments[0], variable_map, false) +
        assemble_expression(expression.arguments[1], variable_map, false);
      break;
    case ValueType.Function:
      string = `adrp  x0, function${expression.func}
add  x0, x0, #:lo12:function${expression.func}
`;
      break;
    case MiscType.Invocation:
      string = `${assemble_expression(expression.func, variable_map, false)}mov  x9, x0
${load_args(expression.arguments)}blr  x9
`;
      break;
    case OperatorType.Add: {
      string = load_args(expression.arguments);
      switch (expression.value_type) {
        case VariableType.UNDEF:
        case VariableType.func:
          console.error("Invalid addition!");
          exit(1);
          break;
        case VariableType.int:
          string += "add  x0, x0, x1\n";
          break;
        case VariableType.str:
          string += "bl  string_add";
      }
    }
      break;
    default: {
      string = load_args(expression.arguments) + (OperatorMap[expression.type].assembly);
      break;
    }
  }
  if (push_result) {
    string += push();
  }
  return string;
};

const set_parameters = (func: Func) =>
  func.parameters.reduce((asm, arg, i) => asm + `str  x${i}, [x29, #${to_offset(func.variables[arg.label].index)}]
`, "");

const assemble_function = (func: Func) =>
  `  ${func.index == 0 ? "main" : `function${func.index}`}:
stp  x29, x30, [sp, #-16]!
mov  x29, sp
sub  sp, sp, ${func.num_variables * 16}
${set_parameters(func)}
${assemble_expression(func.body, func.variables, false)}
add  sp, sp, ${func.num_variables * 16}
ldp  x29, x30, [sp], #16
ret
`;

const load_strings = (strings: Record<string, number>) => {
  return Object.entries(strings).reduce((asm, [str, index,]) => asm +
    `string${index}:
  .asciz "${str}"
`, "");
};

export const assemble = (main: Prog) => {

  return `.data
${load_strings(main.strings)}

  .text
  .extern string_add
  .global main
${main.functions.reduce((asm, func) => asm + assemble_function(func), "")}
`;
};
