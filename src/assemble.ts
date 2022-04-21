import { exit } from "process";
import dedent from "ts-dedent";
import { OperatorMap } from "./constants";
import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  Prog,
  ValueType,
  VariableInfo,
  VariableType,
} from "./types";

/*
  A closure object represents function invocations
  with optional bound variables

  0: Pointer to the actual function
  ((n + 1) * 8): n'th bound argument (0 indexed) to the function

  Note that the bounded list is prepended as an argument to the function itself
*/

/*
  Captured variables are pointers to values
  Standard (uncaptured) variables are directly stored on stack
*/

const get_unique_int = (() => {
  let x = 0;
  return () => x++;
})();

const pop = (register = 0) => `ldr  x${register}, [sp], #16\n`;
const push = (register = 0) => `str  x${register}, [sp, #-16]!\n`;

const to_offset = (var_index: number) => -16 * (var_index + 1);

const assemble_expression = (
  expression: Expression,
  variable_map: Record<string, VariableInfo>,
  function_map: Record<number, Func>,
  push_result = true
): string => {
  const assemble_subexpression = (expression: Expression, push_result = true) =>
    assemble_expression(expression, variable_map, function_map, push_result);

  const load_args = (args: Expression[], starting_reg = 0) =>
    args
      .map(
        // generate the arg values and load them onto the stack
        // but leave the last one in x0 (optimization)
        (expression, i, { length }) =>
          assemble_subexpression(expression, i !== length - 1)
      )
      .join("") +
    // shift the last argument into the appropriate register
    // if it is not already there
    (args.length >= 2 || starting_reg > 0
      ? `mov  x${args.length - 1 + starting_reg}, x0\n`
      : "") +
    args.slice(0, -1).reduce(
      // pop the arg values into the appropriate registers
      (assembly, _, i) => pop(i + starting_reg) + assembly,
      ""
    );

  let string;
  switch (expression.type) {
    case ValueType.Integer:
      string = `ldr  x0, =${expression.value}\n`;
      break;
    case ValueType.String:
      string = dedent`
        adrp  x0, string${expression.index}
        add  x0, x0, #:lo12:string${expression.index}\n
      `;
      break;
    case ValueType.Variable: {
      const { index, captured } = variable_map[expression.label];
      const var_offset = to_offset(index);
      string = captured
        ? dedent`
          ldr  x0, [x29, #${var_offset}]
          ldr  x0, [x0]\n
        `
        : `ldr  x0, [x29, #${var_offset}]\n`;
      break;
    }
    case VariableType.int:
    case VariableType.str:
    case VariableType.func:
    case VariableType.UNDEF:
      // these should never be reached
      exit(1);
      break;
    case OperatorType.Assignment: {
      string = assemble_subexpression(expression.value, false);
      const info = variable_map[expression.variable.label];
      if (info.captured) {
        string += dedent`
          ldr  x1, [x29, #${to_offset(info.index)}]
          str  x0, [x1]\n
        `;
      } else {
        string += `str  x0, [x29, #${to_offset(info.index)}]\n`;
      }
      break;
    }
    case OperatorType.Colon:
      // Does not actually do anything meaningful itself
      string = "";
      break;
    case OperatorType.Semicolon:
      string =
        assemble_subexpression(expression.arguments[0], false) +
        assemble_subexpression(expression.arguments[1], false);
      break;
    case OperatorType.And: {
      const i = get_unique_int();
      string = dedent`
        ${assemble_subexpression(expression.arguments[0], false).trim()}
        cbz  x0, and${i}
        ${assemble_subexpression(expression.arguments[1], false).trim()}
        and${i}:\n
      `;
      break;
    }
    case ValueType.Function:
      {
        const { bound } = function_map[expression.func];
        // create closure object, then load in the bound parameters
        string = dedent`
        mov  x0, ${8 * (bound.length + 1)}
        bl   malloc
        adrp x1, function${expression.func}
        add  x1, x1, #:lo12:function${expression.func}
        str  x1, [x0]
        ${bound
          .map(
            (label, i) => dedent`
          ldr  x1, [x29, #${to_offset(variable_map[label].index)}]
          str  x1, [x0, ${(i + 1) * 8}]
        `
          )
          .join("\n")}\n
      `;
      }
      break;
    case MiscType.Invocation:
      string = dedent`
        ${assemble_subexpression(expression.func, false).trim()}
        ldr  x9, [x0], #8
        mov  x10, x0
        ${load_args(expression.arguments, 1).trim()}
        mov  x0, x10
        blr  x9\n
      `;
      break;
    case OperatorType.Add:
      {
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
            string += "bl   string_add\n";
        }
      }
      break;
    default: {
      string =
        load_args(expression.arguments) +
        String(OperatorMap[expression.type].assembly);
      break;
    }
  }
  if (push_result) {
    string += push();
  }
  return string;
};

const set_parameters = (func: Func) => {
  const bound_vars = func.bound
    .map(
      (label, i) => dedent`
        ldr  x9, [x0, #${i * 8}]
        str  x9, [x29, #${to_offset(func.variables[label].index)}]
      `
    )
    .join("\n");
  const params = func.parameters
    .map(({ label }) => func.variables[label])
    .map(({ captured, index }, i) =>
      captured
        ? dedent`
          ldr  x9, [x29, #${to_offset(index)}]
          str  x${i + 1}, [x9]
        `
        : `str  x${i + 1}, [x29, #${to_offset(index)}]`
    )
    .join("\n");

  return dedent`
    ${bound_vars}
    ${params}
  `;
};

const set_captured = (func: Func) => {
  const heap_alloc = Object.entries(func.variables)
    .filter(([label, { captured }]) => captured && !func.bound.includes(label))
    .map(([, { index }]) => index);
  if (heap_alloc.length === 0) {
    return "";
  } else {
    return dedent`
      mov  x19, x0
      mov  x0, #${heap_alloc.length * 8}
      bl   malloc
      str  x0, [x29, #${to_offset(heap_alloc[0])}]
      ${heap_alloc
        .slice(1)
        .map(
          (var_index, i) => dedent`
          add  x1, x0, #${(i + 1) * 8}
          str  x1, [x29, #${to_offset(var_index)}]
        `
        )
        .join("\n")}
      mov  x0, x19
    `;
  }
};

const assemble_function = (
  func: Func,
  function_map: Record<number, Func>
) => dedent`
  ${func.index === 0 ? "main" : `function${func.index}`}:
  stp  x29, x30, [sp, #-16]!
  mov  x29, sp
  sub  sp, sp, #${func.num_variables * 16}
  /// SETTING CAPTURED VARIABLES
  ${set_captured(func)}
  /// SETTING PARAMETERS
  ${set_parameters(func)}
  /// FUNCTION BODY
  ${assemble_expression(func.body, func.variables, function_map, false).trim()}
  add  sp, sp, #${func.num_variables * 16}
  ldp  x29, x30, [sp], #16
  ret\n
`;

const load_strings = (strings: Record<string, number>) =>
  Object.entries(strings)
    .map(
      ([str, index]) => dedent`
    \  string${index}:
    .asciz "${str}"
  `
    )
    .join("\n");

export const assemble = (main: Prog) => dedent`
  \  .data
  ${load_strings(main.strings).trim()}
  .text
    .extern string_add
    .global main
  ${Object.values(main.functions)
    .map((func) => assemble_function(func, main.functions))
    .join("")}
`;
