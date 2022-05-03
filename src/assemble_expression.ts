import { exit } from "process";
import dedent from "ts-dedent";
import { to_offset } from "./assemble";
import { OperatorMap } from "./constants";
import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  ValueType,
  VariableExpression,
  VariableInfo,
  VariableType,
} from "./types";

const get_unique_int = (() => {
  let x = 0;
  return () => x++;
})();

const pop = (register = 4) => `ldr  x${register}, [sp], #16\n`;
const push = (register = 4) => `str  x${register}, [sp, #-16]!\n`;

export const assemble_expression_arr = (
  expression_sequence: Expression[],
  variable_map: Record<string, VariableInfo>,
  function_map: Record<number, Func>,
  push_result = true
) =>
  expression_sequence
    .map((expression) =>
      assemble_expression(expression, variable_map, function_map, push_result)
    )
    .join("");

const assemble_expression = (
  expression: Expression,
  variable_map: Record<string, VariableInfo>,
  function_map: Record<number, Func>,
  push_result = true
): string => {
  const assemble_subexpression_arr = (
    expression_sequence: Expression[],
    push_result = true
  ) =>
    assemble_expression_arr(
      expression_sequence,
      variable_map,
      function_map,
      push_result
    );

  const save_var = (register: number, label: string) => {
    const { captured, index } = variable_map[label];
    const offset = to_offset(index);
    if (captured) {
      return dedent`
        ldr  x4, [x29, #${offset}]
        str  x${register}, [x4]\n
      `;
    } else {
      return `str  x${register}, [x29, #${offset}]\n`;
    }
  };

  const save_all = (regs: Record<number, string>) =>
    Object.entries(regs)
      .map(([reg, label]) => save_var(Number(reg), label))
      .join("");

  const save_captured = (regs: Record<number, string>) =>
    Object.entries(regs)
      .filter(([, label]) => variable_map[label].captured)
      .map(([reg, label]) => save_var(Number(reg), label))
      .join("");

  const load_var = (register: number, label: string) => {
    const { captured, index } = variable_map[label];
    const offset = to_offset(index);
    if (captured) {
      return dedent`
            ldr  x${register}, [x29, #${offset}]
            ldr  x${register}, [x${register}]\n
          `;
    } else {
      return `ldr  x${register}, [x29, #${offset}]\n`;
    }
  };

  const load_all = (regs: Record<number, string>) =>
    Object.entries(regs)
      .reverse()
      .map(([reg, label]) => load_var(Number(reg), label))
      .join("");

  const set_register_var = (expr: VariableExpression) => {
    const { label, register, evict } = expr;
    if (register === undefined) {
      throw new TypeError("Register allocation failed");
    }
    let str = "";
    // if there is another variable already in there, save it
    if (evict && evict !== label) {
      str = save_var(register, evict);
    }
    // load new var into reg, if not already in there
    if (evict !== label) {
      str += load_var(register, label);
    }
    return str;
  };

  const load_args = (args: Expression[][], starting_reg = 4) =>
    args
      .map(
        // generate the arg values and load them onto the stack
        // but leave the last one in x4 (optimization)
        (expression, i, { length }) =>
          assemble_subexpression_arr(expression, i !== length - 1)
      )
      .join("") +
    // shift the last argument into the appropriate register
    // if it is not already there
    `mov  x${args.length - 1 + starting_reg}, x4\n` +
    args.slice(0, -1).reduce(
      // pop the arg values into the appropriate registers
      (assembly, _, i) => pop(i + starting_reg) + assembly,
      ""
    );

  let string;
  switch (expression.type) {
    case ValueType.Integer:
      string = `ldr  x4, =${expression.value}\n`;
      break;
    case ValueType.String:
      string = dedent`
        adrp x4, string${expression.index}
        add  x4, x4, #:lo12:string${expression.index}\n
      `;
      break;
    case ValueType.Variable: {
      const { register } = expression;
      string = dedent`
        ${set_register_var(expression).trimEnd()}
        mov  x4, x${register as number}\n
      `;
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
      const { register } = expression.variable;
      string = dedent`
        ${assemble_subexpression_arr(expression.value).trimEnd()}
        ${set_register_var(expression.variable).trimEnd()}
        ${pop().trimEnd()}
        mov  x${register as number}, x4\n
      `;
      break;
    }
    case OperatorType.Colon:
      // Does not actually do anything meaningful itself
      string = "";
      break;
    case OperatorType.Semicolon:
      string =
        assemble_subexpression_arr(expression.arguments[0], false) +
        assemble_subexpression_arr(expression.arguments[1], false);
      break;
    case OperatorType.And: {
      const i = get_unique_int();
      string = dedent`
        ${assemble_subexpression_arr(expression.arguments[0], false).trimEnd()}
        cbz  x4, and${i}
        ${assemble_subexpression_arr(expression.arguments[1], false).trimEnd()}
        and${i}:\n
      `;
      break;
    }
    case OperatorType.Or: {
      const i = get_unique_int();
      string = dedent`
        ${assemble_subexpression_arr(expression.arguments[0], false).trimEnd()}
        cbnz  x4, or${i}
        ${assemble_subexpression_arr(expression.arguments[1], false).trimEnd()}
        or${i}:\n
      `;
      break;
    }
    case ValueType.Function:
      {
        const { bound } = function_map[expression.func];
        // create closure object, then load in the bound parameters
        if (expression.used_registers === undefined) {
          throw new TypeError("Register record saving failed");
        }
        string = dedent`
          mov  x4, x0
          mov  x0, #${8 * (bound.length + 1)}
          // SAVING
          ${save_all(expression.used_registers)}
          bl   malloc
          ${load_all(expression.used_registers)}
          // LOADED
          adrp x5, function${expression.func}
          add  x5, x5, #:lo12:function${expression.func}
          str  x5, [x0]
          ${bound
            .map(
              (label, i) => dedent`
            ldr  x5, [x29, #${to_offset(variable_map[label].index)}]
            str  x5, [x0, #${(i + 1) * 8}]
          `
            )
            .join("\n")}
          mov  x5, x0
          mov  x0, x4
          mov  x4, x5\n
        `;
      }
      break;
    case MiscType.Invocation: {
      if (expression.used_registers === undefined) {
        throw new TypeError("Register record saving failed");
      }
      string = dedent`
        ${assemble_subexpression_arr(expression.func).trimEnd()}
        ${
          expression.arguments.length > 0
            ? load_args(expression.arguments, 1).trimEnd()
            : ""
        }
        ${pop(0)}
        ${
          // skips 2 instructions (saving x29/x30/sp)
          expression.is_tail_call
            ? dedent`
              ${save_captured(expression.used_registers)}
              ldr  x4, [x0], #8
              add  x4, x4, #8
              mov  sp, x29
              br   x4
            `
            : dedent`
              ${save_all(expression.used_registers)}
              ldr  x4, [x0], #8
              blr  x4
              ${load_all(expression.used_registers)}
            `
        }\n
      `;
      break;
    }
    case OperatorType.Add:
      {
        string = load_args(expression.arguments);
        switch (expression.value_type) {
          case VariableType.UNDEF:
          case VariableType.func:
            throw TypeError("Invalid addition!");
          case VariableType.int:
            string += "add  x4, x4, x5\n";
            break;
          case VariableType.str:
            string += "bl   string_add\n";
        }
      }
      break;
    case OperatorType.Mult:
      string = dedent`
        ${load_args(expression.arguments)}
        mul  x4, x4, x5\n
      `;
      break;
    case OperatorType.Subtraction:
      string = dedent`
        ${load_args(expression.arguments)}
        sub  x4, x4, x5\n
      `;
      break;
  }
  if (push_result) {
    string += push();
  }
  return string;
};
