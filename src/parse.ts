import { exit } from "process";
import { standard_vars } from "./constants";
import { Context, ParseContext, parse_tokens } from "./parse_tokens";
import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  Prog,
  Token,
  ValueType,
  VariableInfo,
  VariableType,
} from "./types";
type MapExpresionReturn = {
  variable_map: Record<string, VariableInfo>;
  num_variables: number;
  bound_variables: string[];
};

const map_expression_arr = (
  expression_arr: Expression[],
  variable_map: Record<string, VariableInfo> = {},
  num_variables = 0,
  bound_variables: string[] = []
): MapExpresionReturn =>
  expression_arr.reduce(
    ({ variable_map, bound_variables, num_variables }, expression) =>
      map_expression(expression, variable_map, num_variables, bound_variables),
    {
      bound_variables,
      num_variables,
      variable_map,
    }
  );

const map_expression = (
  expression: Expression,
  variable_map: Record<string, VariableInfo> = {},
  num_variables = 0,
  bound_variables: string[] = []
): MapExpresionReturn => {
  switch (expression.type) {
    case OperatorType.Colon: {
      const { variable, variable_type } = expression;
      variable_map[variable.label] = {
        captured: false,
        index: num_variables,
        type: variable_type.type,
      };
      return {
        bound_variables,
        num_variables: num_variables + 1,
        variable_map,
      };
    }
    case OperatorType.Assignment: {
      ({ bound_variables, variable_map, num_variables } = map_expression(
        expression.variable,
        variable_map,
        num_variables,
        bound_variables
      ));
      return map_expression_arr(
        expression.value,
        variable_map,
        num_variables,
        bound_variables
      );
    }
    case ValueType.Variable:
      if (
        expression.label in variable_map ||
        bound_variables.includes(expression.label)
      ) {
        return {
          bound_variables,
          num_variables,
          variable_map,
        };
      } else {
        return {
          bound_variables: [...bound_variables, expression.label],
          num_variables,
          variable_map,
        };
      }
    case ValueType.Integer:
    case ValueType.String:
    case ValueType.Function:
      return {
        bound_variables,
        num_variables,
        variable_map,
      };
    case VariableType.int:
    case VariableType.str:
    case VariableType.arr:
    case VariableType.func:
    case VariableType.UNDEF:
      console.error("ERROR: type specified as argument to operator");
      exit(1);
      break;
    case MiscType.Indexing: {
      ({ bound_variables, num_variables, variable_map } = map_expression_arr(
        expression.array,
        variable_map,
        num_variables,
        bound_variables
      ));
      return map_expression_arr(
        expression.index,
        variable_map,
        num_variables,
        bound_variables
      );
    }
    case MiscType.Invocation: {
      ({ bound_variables, num_variables, variable_map } = map_expression_arr(
        expression.func,
        variable_map,
        num_variables,
        bound_variables
      ));
    }
    // fall through
    default:
      return expression.arguments.reduce(
        (data, expression) =>
          map_expression_arr(
            expression,
            data.variable_map,
            data.num_variables,
            data.bound_variables
          ),
        {
          bound_variables,
          num_variables,
          variable_map,
        }
      );
  }
};

type IndexifyStringReturn = {
  num_strings: number;
  string_map: Record<string, number>;
};

const indexify_strings_arr = (
  expression_arr: Expression[],
  string_map: Record<string, number> = {},
  num_strings = 0
): IndexifyStringReturn =>
  expression_arr.reduce(
    ({ string_map, num_strings }, expression) =>
      indexify_strings(expression, string_map, num_strings),
    {
      num_strings,
      string_map,
    }
  );

const indexify_strings = (
  expression: Expression,
  string_map: Record<string, number>,
  num_strings = 0
): IndexifyStringReturn => {
  switch (expression.type) {
    case ValueType.String:
      if (!(expression.string in string_map)) {
        string_map[expression.string] = num_strings;
        ++num_strings;
      }
      expression.index = string_map[expression.string];
      return {
        num_strings,
        string_map,
      };
    case OperatorType.Assignment:
      return indexify_strings_arr(expression.value, string_map, num_strings);
    case OperatorType.Colon:
    case ValueType.Variable:
    case ValueType.Integer:
    case ValueType.Function:
    case VariableType.str:
    case VariableType.int:
    case VariableType.func:
    case VariableType.arr:
    case VariableType.UNDEF:
      return {
        num_strings,
        string_map,
      };
    case MiscType.Indexing: {
      ({ string_map, num_strings } = indexify_strings_arr(
        expression.array,
        string_map,
        num_strings
      ));
      return indexify_strings_arr(expression.index, string_map, num_strings);
    }
    case MiscType.Invocation: {
      const ret = indexify_strings_arr(
        expression.func,
        string_map,
        num_strings
      );
      num_strings = ret.num_strings;
      string_map = ret.string_map;
      // fall through
    }
    default:
      return expression.arguments.reduce(
        (r, expression) =>
          indexify_strings_arr(expression, r.string_map, r.num_strings),
        { num_strings, string_map }
      );
  }
};

const map_context = (context: Context) => {
  const map: Record<string, VariableInfo> = context.parameters.reduce(
    (mapped, arg, i) => ({
      ...mapped,
      [arg.label]: {
        captured: false,
        index: i,
        type: VariableType.int,
      },
    }),
    {}
  );
  return map_expression_arr(context.body, map, context.parameters.length);
};

type FuncTree = Func & {
  children: FuncTree[];
};

const parse_tree = (tree: ParseContext & Context): FuncTree => {
  const subcontexts = tree.contexts.flatMap((subtree) => parse_tree(subtree));

  const { num_variables, variable_map, bound_variables } = map_context(tree);

  const additional_bound = subcontexts
    .map(({ bound }) => bound)
    .flat()
    .filter(
      (label) => !(label in variable_map || bound_variables.includes(label))
    );
  const f: Func = {
    ...tree,
    bound: bound_variables.concat(additional_bound),
    num_variables,
    variables: variable_map,
  };
  return {
    ...f,
    children: subcontexts,
  };
};

const apply_bound = (
  tree: FuncTree,
  parent_vars: Func["variables"]
): Func[] => {
  tree.bound.forEach((label, i) => {
    tree.variables[label] = {
      captured: true,
      index: tree.num_variables + i,
      type: parent_vars[label].type,
    };
    parent_vars[label].captured = true;
  });

  tree.num_variables += tree.bound.length;

  return [
    tree,
    ...tree.children.map((func) => apply_bound(func, tree.variables)).flat(),
  ];
};

export const parse = (tokens: Token[]): Prog => {
  const parsed = parse_tokens(tokens);
  const main = {
    body: parsed.body,
    contexts: parsed.contexts,
    index: 0,
    parameters: [],
  };

  const functions: Func[] = apply_bound(parse_tree(main), standard_vars);

  const { string_map } = [
    ...parsed.contexts.map(({ body }) => body),
    parsed.body,
  ].reduce(
    ({ string_map, num_strings }, expression) =>
      indexify_strings_arr(expression, string_map, num_strings),
    { num_strings: 0, string_map: {} }
  );
  return {
    functions: functions.reduce(
      (map, func) => ({
        ...map,
        [func.index]: func,
      }),
      {}
    ),
    strings: string_map,
  };
};
