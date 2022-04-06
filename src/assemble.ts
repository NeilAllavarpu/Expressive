import {exit,} from "process";
import {OperatorMap,} from "./constants";
import {Expression, Func, MiscType, OperatorType, ValueType, VariableExpression, VariableType,} from "./types";

const pop = (register = 0) => `ldr  x${register}, [sp], #16\n`;
const push = (register = 0) => `str  x${register}, [sp, #-16]!\n`;

const load_args = (args: Expression[]) => args.reduce(
  (assembly, expression, i, {length,}, ) => assembly + assemble_expression(expression, i != length - 1),
  ""
) + `mov  x${args.length - 1}, x0\n` + args.reduce(
  (assembly, __, i, {length,}) => (i == length - 1 ? "" : pop(i)) + assembly,
  ""
  );

const to_offset = (var_index: number) => -16 * (var_index + 1);

const assemble_expression = (expression: Expression, push_result = true): string => {
  let string;
  switch (expression.type) {
    case ValueType.Literal:
      string = `ldr  x0, =${expression.value}\n`;
      break;
    case ValueType.Variable:
      string = `ldr  x0, [x29, #${to_offset(expression.index)}]\n`;
      break;
    case VariableType.ui64:
      exit(1);
      break;
    case OperatorType.Assignment: {
      string = assemble_expression(expression.value, false) + `str  x0, [x29, #${to_offset(expression.variable.index)}]\n`;
      break;
    }
    case OperatorType.Colon:
      string = "";
      break;
    case OperatorType.Semicolon:
      string = assemble_expression(expression.arguments[0], false) + assemble_expression(expression.arguments[1], false);
      break;
    case MiscType.Function:
      string = `adrp  x0, function${expression.func}
add  x0, x0, #:lo12:function${expression.func}
`;
      break;
    case MiscType.Invocation:

      string = `${assemble_expression(expression.func, false)}mov  x9, x0
${load_args(expression.arguments)}blr  x9
`;
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

const set_parameters = (params: VariableExpression[]) =>
  params.reduce((asm, arg, i) => asm + `str  x${i}, [x29, #${to_offset(arg.index)}]
`, "");

const assemble_function = (func: Func) =>
  `  ${func.index == 0 ? "main" : `function${func.index}`}:
stp  x29, x30, [sp, #-16]!
mov  x29, sp
sub  sp, sp, ${func.num_variables * 16}
${set_parameters(func.parameters)}
${assemble_expression(func.body, false)}
add  sp, sp, ${func.num_variables * 16}
ldp  x29, x30, [sp], #16
ret
`;

export const assemble = (main: Func[]) => {

  return `.text
  .global main
${main.reduce((asm, func) => asm + assemble_function(func), "")}
`;
};
