import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  RegisterMap,
  ValueType,
  VariableExpression,
  VariableType,
} from "./types";

type VariableUsage = Record<string, number[][]>;

const range = (lo: number, hi: number) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const get_var_usage_arr = (
  expressions: Expression[],
  map: VariableUsage = {},
  curr_path: number[] = []
) =>
  expressions.reduce(
    (built, expression, i) =>
      get_var_usage(expression, built, [...curr_path, i]),
    map
  );

const get_var_usage = (
  expression: Expression,
  map: VariableUsage,
  curr_path: number[]
): VariableUsage => {
  switch (expression.type) {
    case ValueType.Integer:
    case ValueType.String:
    case ValueType.Function:
    case VariableType.UNDEF:
    case VariableType.func:
    case VariableType.int:
    case VariableType.str:
    case OperatorType.Colon:
      return map;
    case MiscType.Invocation: {
      // TODO: reset everything
      map = get_var_usage_arr(expression.func, map, [...curr_path, 0]);
      return expression.arguments.reduce(
        (built, expression, i) =>
          get_var_usage_arr(expression, built, [...curr_path, i + 1]),
        map
      );
    }
    case ValueType.Variable: {
      const existing_var_usage = map[expression.label] || [];
      return {
        ...map,
        [expression.label]: [...existing_var_usage, curr_path],
      };
    }
    case OperatorType.Assignment: {
      const existing_var_usage = map[expression.variable.label] || [];
      map = {
        ...map,
        [expression.variable.label]: [...existing_var_usage, [...curr_path, 1]],
      };
      return get_var_usage_arr(expression.value, map, [...curr_path, 0]);
    }
    default: {
      return expression.arguments.reduce(
        (built, expression, i) =>
          get_var_usage_arr(expression, built, [...curr_path, i]),
        map
      );
    }
  }
};

type AllocateArrReturn = {
  expressions: Expression[];
  regs: RegisterMap;
};

const allocate_arr = (
  expressions: Expression[],
  map: VariableUsage,
  regs: RegisterMap
): AllocateArrReturn =>
  expressions.reduce(
    ({ expressions, regs: old_regs }, old_expression) => {
      const { regs, expression } = allocate(old_expression, map, old_regs);
      return {
        expressions: [...expressions, expression],
        regs,
      };
    },
    { expressions: [], regs } as AllocateArrReturn
  );

const compare_arr = (arr0: number[], arr1: number[]): number => {
  if (arr1.length === 0) {
    return arr0.length;
  }
  if (arr0.length === 0) {
    return -1;
  }
  const [pos0] = arr0;
  const [pos1] = arr1;
  if (pos0 !== pos1) {
    return pos0 - pos1;
  }
  return compare_arr(arr0.slice(1), arr1.slice(1));
};

const compare_usage = (usage0: number[][], usage1: number[][]): number => {
  if (usage1.length === 0) {
    return usage0.length;
  }
  if (usage0.length === 0) {
    return -1;
  }
  const [pos0] = usage0;
  const [pos1] = usage1;
  const comparison = compare_arr(pos0, pos1);
  if (comparison !== 0) {
    return comparison;
  }
  return compare_usage(usage0.slice(1), usage1.slice(1));
};

const pick_register = (
  regs: RegisterMap,
  label: string,
  map: VariableUsage
) => {
  const existing_reg = Object.entries(regs).find(
    ([, var_label]) => var_label === label
  );
  if (existing_reg !== undefined) {
    return Number(existing_reg[0]);
  }
  const free_reg = Object.entries(regs).find(
    ([, var_label]) => var_label === null
  );
  if (free_reg !== undefined) {
    return Number(free_reg[0]);
  }
  const furthest_use = Number(
    Object.entries(regs)
      .map(([reg, var_label]) => ({
        reg,
        usage: map[var_label as string],
      }))
      .reduce((max, curr) =>
        compare_usage(curr.usage, max.usage) > 0 ? curr : max
      ).reg
  );
  return furthest_use;
};

const allocate_args = (
  args: Expression[][],
  vars: VariableUsage,
  regs: RegisterMap
) =>
  args.reduce(
    ({ sequences, regs: old_regs }, sequence) => {
      const { regs, expressions } = allocate_arr(sequence, vars, old_regs);
      return {
        regs,
        sequences: [...sequences, expressions],
      };
    },
    { regs, sequences: [] } as {
      sequences: Expression[][];
      regs: RegisterMap;
    }
  );

const slot_var = (
  expression: VariableExpression,
  vars: VariableUsage,
  regs: RegisterMap,
  is_assignment: boolean
) => {
  const reg = pick_register(regs, expression.label, vars);
  return {
    expression: {
      ...expression,
      evict: regs[reg],
      register: reg,
    },
    regs: {
      ...regs,
      [reg]: expression.label,
    },
  };
};

const get_used_regs = (regs: RegisterMap): Record<number, string> =>
  Object.entries(regs)
    .filter(([, alloc_var]) => alloc_var !== null)
    .reduce(
      (map, [reg, label]) => ({
        ...map,
        [reg]: label,
      }),
      {}
    );

const allocate = (
  expression: Expression,
  vars: VariableUsage,
  regs: RegisterMap
): { expression: Expression; regs: RegisterMap } => {
  switch (expression.type) {
    case ValueType.Integer:
    case ValueType.String:
    case VariableType.UNDEF:
    case VariableType.func:
    case VariableType.int:
    case VariableType.str:
    case OperatorType.Colon:
      return { expression, regs };
    case ValueType.Function:
      return {
        expression: {
          ...expression,
          used_registers: get_used_regs(regs),
        },
        regs,
      };
    case MiscType.Invocation: {
      // TODO: reset everything
      const args = allocate_args(expression.arguments, vars, regs);
      const func = allocate_arr(expression.func, vars, args.regs);
      return {
        expression: {
          ...expression,
          arguments: args.sequences,
          func: func.expressions,
          used_registers: get_used_regs(func.regs),
        },
        regs: func.regs,
      };
    }
    case ValueType.Variable:
      return slot_var(expression, vars, regs, false);
    case OperatorType.Assignment: {
      const value = allocate_arr(expression.value, vars, regs);
      const lhs_var = slot_var(expression.variable, vars, value.regs, true);

      return {
        expression: {
          ...expression,
          value: value.expressions,
          variable: lhs_var.expression as VariableExpression,
        },
        regs: lhs_var.regs,
      };
    }
    default: {
      const args = allocate_args(expression.arguments, vars, regs);
      return {
        expression: {
          ...expression,
          arguments: args.sequences,
        },
        regs: args.regs,
      };
    }
  }
};

export const register_allocate = (func: Func) => {
  const usage = get_var_usage_arr(func.body);
  const register_assignments = range(7, 15)
    .concat(range(19, 28))
    .reduce(
      (map, index) => ({
        ...map,
        [index]: null,
      }),
      {}
    );
  const allocation = allocate_arr(func.body, usage, register_assignments);
  return {
    ...func,
    body: allocation.expressions,
  };
};
