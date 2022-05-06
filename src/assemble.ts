import dedent from "ts-dedent";
import { assemble_expression_arr } from "./assemble_expression";
import { standard_vars } from "./constants";
import { Func, Prog, RegisterMap } from "./types";

const var_size = 8;

export const to_offset = (var_index: number) => -var_size * (var_index + 1);

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

const round_to_multiple = (num: number, mod: number) =>
  num - 1 + mod - ((num - 1) % mod);

const var_stack_space = (num_variables: number) => num_variables * var_size;

const setup_main = ({ variables, bound }: Func) => {
  const func_size = 16;
  const requested_vars = Object.keys(standard_vars)
    .filter((label) => label in variables)
    .sort((var1, var2) => bound.indexOf(var1) - bound.indexOf(var2));
  const block_space = var_size * requested_vars.length;
  const block_offset = func_size * requested_vars.length;
  return dedent`
    mov  x0, #${block_offset + block_space}
    bl   malloc
    add  x0, x0, #${block_offset + block_space}
    ${requested_vars
      .map(
        (_, i) => dedent`
          sub  x1, x0, #${func_size * (i + 1)}
          str  x1, [x0, #-${block_offset + block_space - 8 * i}]
        `
      )
      .join("\n")}
    ${requested_vars
      .map((label, i) => {
        const offset = i * func_size;
        return dedent`
          adrp x1, ${label}
          add  x1, x1, #:lo12:${label}
          str  x1, [x0, #-${offset + 8}]
          sub  x1, x0, #${offset + 8}
          str  x1, [x0, #-${offset + 16}]
        `;
      })
      .join("\n")}
    sub  x0, x0, #${block_offset + block_space}
  `;
};

const save_var = (
  register: number,
  label: string,
  variable_map: Func["variables"]
) => {
  const { captured, index } = variable_map[label];
  const offset = to_offset(index);
  if (captured) {
    return dedent`
        ldr  x0, [x29, #${offset}]
        str  x${register}, [x0]\n
      `;
  } else {
    return `str  x${register}, [x29, #${offset}]\n`;
  }
};

const save_captured = (regs: RegisterMap, variable_map: Func["variables"]) =>
  Object.entries(regs)
    .filter(([, label]) => label !== null && variable_map[label].captured)
    .map(([reg, label]) => save_var(Number(reg), label as string, variable_map))
    .join("");

const assemble_function = (
  func: Func,
  function_map: Record<number, Func>
) => dedent`
  ${func.index === 0 ? "main" : `function${func.index}`}:
  stp  x29, x30, [sp, #-16]!
  mov  x29, sp
  ${func.index === 0 ? setup_main(func) : ""}
  sub  sp, sp, #${round_to_multiple(var_stack_space(func.num_variables), 16)}
  /// SETTING PARAMETERS
  ${set_parameters(func).trimEnd()}
  /// SETTING CAPTURED VARIABLES
  ${set_captured(func).trimEnd()}
  /// FUNCTION BODY
  ${assemble_expression_arr(
    func.body,
    func.variables,
    function_map,
    false
  ).trimEnd()}
  ${save_captured(func.used_registers as RegisterMap, func.variables)}
  mov  sp, x29
  ldp  x29, x30, [sp], #16
  ret\n
`;

const load_strings = (strings: Record<string, number>) =>
  Object.entries(strings)
    .map(([str, index]) => `string${index}: .asciz "${str}"`)
    .join("\n");

export const assemble = (main: Prog) => dedent`
  \  .data
  ${load_strings(main.strings).trimEnd()}
    .text
    .global main
  ${Object.values(main.functions)
    .map((func) => assemble_function(func, main.functions))
    .join("")}
`;
