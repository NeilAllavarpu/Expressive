import {exit,} from "process";
import {OperatorMap,} from "./constants";
import {Expression, Func, MiscType, OperatorType, Prog, SemanticType, Token, TokenType, TypeExpression, ValueType, VariableExpression, VariableInfo, VariableType, } from "./types";

const terminating_tokens: TokenType[] = [SemanticType.RightParen, SemanticType.RightBrace, SemanticType.Comma,];

const is_terminating = (tokens: Token[], index: number) => index >= tokens.length || terminating_tokens.includes(tokens[index].type);

type Context = Pick<Func, "body" | "parameters" | "index">;

type ParseContext = {
  index: number;
  contexts: (ParseContext & Context)[];
  body: Expression;
};

export const parse_tokens = (tokens: Token[], index = 0, min_bind = 0): ParseContext | never => {
  if (index >= tokens.length) {
    console.error("Unexpected end of file");
    exit(1);
  }

  let expression: Expression;
  let contexts: ParseContext["contexts"] = [];

  const curr_token = tokens[index];
  switch (curr_token.type) {
    case ValueType.Integer:
      expression = {
        "type": ValueType.Integer,
        "value": curr_token.integer,
        "value_type": VariableType.int,
      };
      break;
    case ValueType.String:
      expression = {
        "index": -1,
        "string": curr_token.string,
        "type": ValueType.String,
        "value_type": VariableType.str,
      };
      break;
    case ValueType.Variable:
      expression = {
        "label": curr_token.label,
        "type": ValueType.Variable,
        "value_type": VariableType.UNDEF,
      };
      break;
    case VariableType.int:
    case VariableType.str:
    case VariableType.func:
      expression = {
        "type": curr_token.type,
        "value_type": VariableType.UNDEF,
      };
      break;
    case SemanticType.LeftParen: {
      const parsed = parse_tokens(tokens, index + 1);
      expression = parsed.body;
      index = parsed.index;
      contexts = contexts.concat(parsed.contexts);
      if (index >= tokens.length || tokens[index].type != SemanticType.RightParen) {
        console.error("ERROR: Missing closing parenthesis");
        exit(1);
      }
      break;
    }
    case SemanticType.LeftBrace: {
      // consume parameters
      const end_param_index = tokens.slice(index + 1)
        .findIndex(({type, }) => type == SemanticType.RightBrace) + index + 1;
      if (end_param_index == index) {
        console.error("ERROR: Missing closing curly brace for parameter list");
        exit(1);
      }
      const parameters: VariableExpression[] = tokens.slice(index + 1, end_param_index).map((variable) => {
        if (variable.type != ValueType.Variable) {
          console.error("ERROR: Non-parameter in parameter list");
          exit(1);
        }
        return {
          "label": variable.label,
          "type": ValueType.Variable,
          "value_type": VariableType.UNDEF,
        };
      });
      index = end_param_index + 1;
      if (index >= tokens.length || tokens[index].type != SemanticType.LeftBrace) {
        console.error("ERROR: Missing function body");
        exit(1);
      }
      const parsed = parse_tokens(tokens, index + 1);
      index = parsed.index;
      contexts = [...contexts, {
        "body": parsed.body,
        "contexts": parsed.contexts,
        index,
        parameters,
      },];
      if (index >= tokens.length || tokens[index].type != SemanticType.RightBrace) {
        console.error("ERROR: Missing closing brace");
        exit(1);
      }
      expression = {
        "func": index,
        "type": ValueType.Function,
        "value_type": VariableType.func,
      };
      break;
    }
    default:
      console.error(`Unexpected token ${tokens[index].type} (expected expression)`);
      exit(1);
  }

  ++index;

  while (!is_terminating(tokens, index)) {
    if (tokens[index].type === SemanticType.LeftParen) {
      // consume arguments
      let args: Expression[] = [];
      if (tokens[index + 1].type !== SemanticType.RightParen) {
        while (tokens[index].type !== SemanticType.RightParen) {
          const parsed = parse_tokens(tokens, index + 1, 0);
          index = parsed.index;
          contexts = contexts.concat(parsed.contexts);
          if (tokens[index].type != SemanticType.RightParen && tokens[index].type != SemanticType.Comma) {
            console.error(`Unexpected token ${tokens[index].type} (expected closing parenthesis or comma)`);
            exit(1);
          }
          args = [...args, parsed.body,];
        }
      } else {
        ++index;
      }
      expression = {
        "arguments": args,
        "func": expression,
        "type": MiscType.Invocation,
        "value_type": VariableType.UNDEF,
      };
      ++index;
    } else {
      const operator = OperatorMap[tokens[index].type as OperatorType];
      if (operator === undefined) {
        console.error(`Unexpected token ${tokens[index].type} (expected operator)`);
        exit(1);
      }

      if (operator.left_bind < min_bind) {
        break;
      }
      const parse_result = parse_tokens(tokens, index + 1, operator.right_bind);
      index = parse_result.index;
      contexts = contexts.concat(parse_result.contexts);

      switch (operator.operator) {
        case OperatorType.Colon:
          if (expression.type !== ValueType.Variable) {
            console.error("ERROR: non-variable specified as LHS to colon operator");
            exit(1);
          }
          if (!Object.values(VariableType).includes(parse_result.body.type as VariableType)) {
            console.error("ERROR: non-type specified as RHS to colon operator");
            exit(1);
          }
          expression = {
            "type": OperatorType.Colon,
            "value_type": VariableType.UNDEF,
            "variable": expression,
            "variable_type": parse_result.body as TypeExpression,
          };
          break;
        case OperatorType.Assignment:
          if (expression.type !== ValueType.Variable) {
            console.error("ERROR: non-variable specified as LHS to assignment operator");
            exit(1);
          }
          expression = {
            "type": OperatorType.Assignment,
            "value": parse_result.body,
            "value_type": VariableType.UNDEF,
            "variable": expression,
          };
          break;
        default:
          expression = {
            "arguments": [
              expression,
              parse_result.body,
            ],
            "type": operator.operator,
            "value_type": VariableType.UNDEF,
          };
      }
    }
  }

  return {
    "body": expression,
    contexts,
    index,
  };
};


type MapExpresionReturn = {
  variable_map: Record<string, VariableInfo>;
  num_variables: number;
  bound_variables: string[];
};

const map_expression = (expression: Expression, variable_map: Record<string, VariableInfo> = {}, num_variables = 0, bound_variables:string[] = []): MapExpresionReturn => {
  switch (expression.type) {
    case OperatorType.Colon: {
      const {variable, variable_type,} = expression;
      variable_map[variable.label] = {
        "captured": false,
        "index": num_variables,
        "type": variable_type.type,
      };
      return {
        bound_variables,
        "num_variables": num_variables + 1,
        variable_map,
      };
    }
    case OperatorType.Assignment: {
       ({bound_variables, variable_map, num_variables} = map_expression(expression.variable, variable_map, num_variables, bound_variables));
      return map_expression(expression.value, variable_map, num_variables, bound_variables);
    }
    case ValueType.Variable:
      if (variable_map.hasOwnProperty(expression.label) || bound_variables.includes(expression.label)) {
        return {
          bound_variables,
          num_variables,
          variable_map,
        };
      } else {
        return {
          "bound_variables": [...bound_variables, expression.label,],
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
    case VariableType.func:
    case VariableType.UNDEF:
      console.error("ERROR: type specified as argument to operator");
      exit(1);
      break;
    case MiscType.Invocation: {
      ({bound_variables, num_variables, variable_map} = map_expression(expression.func, variable_map, num_variables, bound_variables));
    }
      // fall through
    default:
      return expression.arguments.reduce((data, expression) =>
        map_expression(expression,
                       data.variable_map,
                       data.num_variables,
                       data.bound_variables), {
          bound_variables,
          num_variables,
          variable_map,
        });
  }
};

type IndexifyStringReturn = {
  num_strings: number;
  string_map: Record<string, number>;
};

const indexify_strings = (expression: Expression, string_map: Record<string, number> = {}, num_strings = 0): IndexifyStringReturn => {
  switch (expression.type) {
    case ValueType.String:
      if (!string_map.hasOwnProperty(expression.string)) {
        string_map[expression.string] = num_strings;
        ++num_strings;
      }
      expression.index = string_map[expression.string];
      return {
        num_strings,
        string_map,
      };
    case OperatorType.Assignment:
      return indexify_strings(expression.value, string_map, num_strings);
    case OperatorType.Colon:
    case ValueType.Variable:
    case ValueType.Integer:
    case ValueType.Function:
    case VariableType.str:
    case VariableType.int:
    case VariableType.func:
    case VariableType.UNDEF:
      return {
        num_strings,
        string_map,
      };
    case MiscType.Invocation: {
      const ret = indexify_strings(expression.func, string_map, num_strings);
      num_strings = ret.num_strings;
      string_map = ret.string_map;
      // fall through
    }
    default:
      return expression.arguments.reduce(
        (r, expression) =>
          indexify_strings(expression, r.string_map, r.num_strings),
        {num_strings, string_map,});
  }
};

const map_context = (context: Context) => {
  const map: Record<string, VariableInfo> = context.parameters.reduce((mapped, arg, i) => ({
    ...mapped,
    [arg.label]: {
      "captured": false,
      "index": i,
      "type": VariableType.int,
    },
  }), {});
  return map_expression(
    context.body,
    map,
    context.parameters.length);
};

const typify = (expression: Expression, variables: Func["variables"]) => {
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
        console.error("ERROR: type of variable does not match type of expression in assignment!");
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
        console.error("ERROR: non-function attempting to be invoked!");
        // exit(1);
      }
      // fall through
    }
    default:
      expression.arguments.forEach((expr) => {
        typify(expr, variables);
      });
      if (expression.type !== OperatorType.Semicolon &&
        !expression.arguments.every(({value_type,}) =>
          value_type === expression.arguments[0].value_type)) {
        console.error("ERROR: mismatch of types in operation!");
        // exit(1);
      }
      if (expression.type !== MiscType.Invocation) {
        expression.value_type = expression.arguments[0].value_type;
      }
  }
};

const parse_tree = (tree: ParseContext & Context, parent_vars:Record<string, VariableInfo> = {}): Func[] => {
  let {num_variables, variable_map, bound_variables,} = map_context(tree);

  bound_variables.forEach((label, i) => {
    variable_map[label] = {
      "captured": true,
      "index": num_variables + i,
      "type": VariableType.int,
    };
    parent_vars[label].captured = true;
  });
  num_variables += bound_variables.length;
  typify(tree.body, variable_map);
  const f: Func = {
    ...tree,
    "bound": bound_variables,
    num_variables,
    "variables": variable_map,
  };
  return [f, ...tree.contexts.flatMap((subtree) => parse_tree(subtree, variable_map)),];
};

export const parse = (tokens: Token[]): Prog => {
  const parsed = parse_tokens(tokens);
  const main:  ParseContext & Context =  {
    "body": parsed.body,
    "contexts": parsed.contexts,
    "index": 0,
    "parameters": [],
  };

  const functions: Func[] = parse_tree(main);


  const string_map = {};
    // [...parsed.contexts.map(({body,}) => body),
    //   parsed.body,]
    // .reduce(
    //     (r, expression) =>
    //       indexify_strings(expression, r.string_map, r.num_strings),
    //     {"num_strings": 0, "string_map": {},});
  return {
    "functions": functions.reduce((map, func) => ({
      ...map,
      [func.index]: func,
    }), {}),
    "strings": string_map,
  };
};
