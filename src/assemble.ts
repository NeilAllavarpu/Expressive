import {exit,} from "process";
import {OperatorMap,} from "./constants";
import {Expression, Func, MiscType, OperatorType, Prog, ValueType, VariableExpression, VariableInfo, VariableType, } from "./types";

const get_unique_int = (() => {
  let x = 0;
  return () => x++;
})();

const pop = (register = 0) => `ldr  x${register}, [sp], #16\n`;
const push = (register = 0) => `str  x${register}, [sp, #-16]!\n`;

const to_offset = (var_index: number) => -16 * (var_index + 1);

const assemble_expression = (expression: Expression, variable_map: Record<string, VariableInfo>, function_map: Record<number, Func>, push_result = true): string => {
  const load_args = (args: Expression[], starting_reg = 0) => args.reduce(
    (assembly, expression, i, {length, },) =>
      assembly +
      assemble_expression(expression, variable_map, function_map, i != length - 1), ""
  ) + (args.length >= 2 ||  starting_reg > 0 ? `mov  x${args.length - 1 + starting_reg}, x0\n` : "") +
    args.reduce((assembly, __, i, {length, }) =>
      (i == length - 1 ? "" : pop(i + starting_reg)) + assembly, ""
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
      if (variable_map[expression.label].captured) {
        string = `ldr  x0, [x29, #${to_offset(variable_map[expression.label].index)}]
ldr  x0, [x0]
`;
      } else {
        string = `ldr  x0, [x29, #${to_offset(variable_map[expression.label].index)}]\n`;
      }
      break;
    case VariableType.int:
    case VariableType.str:
    case VariableType.func:
    case VariableType.UNDEF:
      exit(1);
      break;
    case OperatorType.Assignment: {
      string = assemble_expression(expression.value, variable_map, function_map, false);
      const info = variable_map[expression.variable.label];
      if (info.captured) {
        string += `ldr  x1, [x29, #${to_offset(info.index)}]
str  x0, [x1]\n`;
      } else {
        string += `str  x0, [x29, #${to_offset(info.index)}]\n`;
      }
      break;
    }
    case OperatorType.Colon:
      string = "";
      break;
    case OperatorType.Semicolon:
      string = assemble_expression(expression.arguments[0], variable_map, function_map, false) +
        assemble_expression(expression.arguments[1], variable_map, function_map, false);
      break;
    case OperatorType.And: {
      const i = get_unique_int();
      string = assemble_expression(expression.arguments[0], variable_map, function_map, false) + `cbz  x0, and${i}\n` +
        assemble_expression(expression.arguments[1], variable_map, function_map, false) +
`and${i}:
`;
      break;
    }
    case ValueType.Function: {
      const {bound,} = function_map[expression.func];
      string = `mov  x0, ${8 * (bound.length + 1)}
bl malloc
adrp x1, function${expression.func}
add  x1, x1, #:lo12:function${expression.func}
str  x1, [x0]
${bound.reduce((asm, label, i) => asm + `ldr  x1, [x29, #${to_offset(variable_map[label].index)}]
str  x1, [x0, ${(i + 1) * 8}]
`, "")}

`;
    }
      break;
    case MiscType.Invocation:
      string = `${assemble_expression(expression.func, variable_map, function_map, false)}
ldr  x9, [x0], #8
mov  x10, x0
${load_args(expression.arguments, 1)}mov  x0, x10
blr  x9
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

const set_parameters = (func: Func) => {
  const bound_vars = func.bound.reduce((asm, label, i) => asm +
    `ldr  x9, [x0, #${i * 8}]
str  x9, [x29, #${to_offset(func.variables[label].index)}]
`, "");
  const params = func.parameters
    .map(({label}, i) =>
    (func.variables[label].captured ?
`ldr  x9, [x29, #${to_offset(func.variables[label].index)}]
str  x${i + 1}, [x9]\n` :
`str  x${i + 1}, [x29, #${to_offset(func.variables[label].index)}]\n`), "").join("");
  return bound_vars + params;
};

const set_captured = (func: Func) => {
  const heap_alloc = Object.entries(func.variables)
    .filter(([label, {captured, },]) => captured && !func.bound.includes(label));
  if (heap_alloc.length == 0) {
    return "";
  } else {
    return `mov  x19, x0
mov  x0, #${heap_alloc.length * 8}
bl   malloc
str  x0, [x29, #${to_offset(heap_alloc[0][1].index)}]
${heap_alloc.slice(1).reduce((asm, [_, {index}], i) => asm + `add  x1, x0, #${(i + 1) * 8}
str  x1, [x29, #${to_offset(index)}]\n`, "")}
mov  x0, x19
`;
  }
};

const assemble_function = (func: Func, function_map: Record<number, Func>) =>
  `  ${func.index == 0 ? "main" : `function${func.index}`}:
stp  x29, x30, [sp, #-16]!
mov  x29, sp
sub  sp, sp, #${func.num_variables * 16}
///
${set_captured(func)}
///
${set_parameters(func)}
///
${assemble_expression(func.body, func.variables, function_map, false)}
add  sp, sp, #${func.num_variables * 16}
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
${load_strings(main.strings)}\
  .text
  .extern string_add
  .global main
${Object.values(main.functions).reduce((asm, func) => asm + assemble_function(func, main.functions), "")}
`;
};
