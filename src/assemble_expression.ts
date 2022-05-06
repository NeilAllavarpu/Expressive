import { exit } from "process";
import dedent from "ts-dedent";
import { to_offset } from "./assemble";
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

const round_up_pwr_2 = (n: number) => {
  let ans = 1;
  while (n !== 0) {
    ans <<= 1;
    n >>= 1;
  }
  return ans;
};

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
    case ValueType.Array: {
      const { used_registers } = expression;
      if (used_registers === undefined) {
        throw TypeError("beep booop");
      }
      const { length } = expression.arguments;
      const spread_elems = expression.arguments.filter(
        (expression) => expression.at(-1)?.type === MiscType.Spread
      );
      string = dedent`
        ${push(0)}
        ${push(1)}
        ${push(2)}
        mov  x0, #${round_up_pwr_2(length + 1) * 8}
        bl   malloc
        ${push(0)}
        mov  x4, #${length}
        str  x4, [x0], #8
        ${push(0)}
        ${expression.arguments
          .map((expression) => {
            const value = expression.at(-1);
            if (value?.type !== MiscType.Spread) {
              return dedent`
                ${assemble_subexpression_arr(expression, false)}
                ldr  x5, [sp]
                str  x4, [x5]
                add  x5, x5, #8
                str  x5, [sp]
              `;
            }
            const i = get_unique_int();
            // x6 = indexing
            // x0 = arr pointer
            return dedent`
              ${assemble_subexpression_arr(expression.slice(0, -1), false)}
              ${assemble_subexpression_arr(value.array, false)}
              ldr  x0, [sp, #16]
              ldr  x7, [x4]
              ldr  x8, [x0]
              clz  w9, w8
              add  x8, x8, x7
              sub  x8, x8, #1
              str  x8, [x0]
              clz  w10, w8
              cmp  w10, w9
              b.eq continue_alloc${i}

              // round w8 up to nearest power of 2
              mov  w1, #0x80000000
              clz  w5, w8
              sub  w5, w5, #4
              lsr  w1, w1, w5

              ${push(4)}
              bl   realloc
              ${pop(4)}
              str  x0, [sp, #16]

              continue_alloc${i}:
              ldr  x0, [sp]
              add  x1, x4, #8
              ldr  x2, [x4]
              lsl  x2, x2, #3
              add  x5, x0, x2
              str  x5, [sp]
              bl   memcpy
            `;
          })
          .join("\n")}
        ldr  x4, [sp, #16]
        add  sp, sp, #32
        ${pop(2)}
        ${pop(1)}
        ${pop(0)}
      `;
      break;
    }
    case MiscType.Spread: {
      throw TypeError("shoul not reach thi");
      // string = dedent`
      //   ${assemble_subexpression_arr(expression.array).trimEnd()}
      //   ${assemble_subexpression_arr(expression.index, false).trimEnd()}
      //   ${pop(5)}
      //   lsl  x4, x4, #3
      //   add  x4, x4, #8
      //   ldr  x4, [x5, x4]\n
      // `;
      // break;
    }
    case VariableType.int:
    case VariableType.str:
    case VariableType.func:
    case VariableType.arr:
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
    case OperatorType.And:
    case OperatorType.Or: {
      if (expression.used_registers === undefined) {
        throw Error("failed to reg alloc");
      }
      const i = get_unique_int();
      string = dedent`
        ${assemble_subexpression_arr(expression.arguments[0], false).trimEnd()}
        ${
          expression.type === OperatorType.And ? "cbz" : "cbnz"
        }  x4, short_circuit${i}
        ${assemble_subexpression_arr(expression.arguments[1]).trimEnd()}
        ${save_all(expression.used_registers)}
        ${pop(4)}
        short_circuit${i}:\n
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
          ${push(0).trimEnd()}
          mov  x0, #${8 * (bound.length + 1)}
          bl   malloc
          adrp x4, function${expression.func}
          add  x4, x4, #:lo12:function${expression.func}
          str  x4, [x0]
          ${bound
            .map(
              (label, i) => dedent`
                ldr  x4, [x29, #${to_offset(variable_map[label].index)}]
                str  x4, [x0, #${(i + 1) * 8}]
              `
            )
            .join("\n")}
          mov  x4, x0
          ${pop(0)}
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
    case MiscType.Indexing: {
      string = dedent`
        ${assemble_subexpression_arr(expression.array).trimEnd()}
        ${assemble_subexpression_arr(expression.index, false).trimEnd()}
        ${pop(5)}
        lsl  x4, x4, #3
        add  x4, x4, #8
        ldr  x4, [x5, x4]\n
      `;
      break;
    }
    case OperatorType.IndexRange: {
      string = dedent`
        ${push(0)}
        ${push(1)}
        ${push(2)}
        ${assemble_subexpression_arr(expression.array).trimEnd()}
        ${assemble_subexpression_arr(expression.index_lo).trimEnd()}
        ${assemble_subexpression_arr(expression.index_hi, false).trimEnd()}
        ldr  x5, [sp]
        sub  x4, x4, x5
        add  x4, x4, #1
        ${push(4)}
        add  x0, x4, #1
        lsl  x0, x0, #3
        bl   malloc // allocating new arr
        ${pop(4)} // len of range
        ${pop(5)} // start of range
        ${pop(1)} // arr to index
        str  x4, [x0], #8
        lsl  x2, x4, #3

        add  x5, x5, #1 // shift start of mem region
        lsl  x5, x5, #3
        add  x1, x1, x5

        bl   memcpy

        sub  x4, x0, #8 // start of array

        ${pop(2)}
        ${pop(1)}
        ${pop(0)}\n
      `;
      break;
    }
    case OperatorType.Add:
      string = dedent`
        ${load_args(expression.arguments)}
        add  x4, x4, x5\n
      `;
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
