import {exit,} from "process";
import {OperatorMap,} from "./constants";
import {Expression, Func, MiscType, OperatorType, SemanticType, Token, TokenType, TypeExpression, ValueType, VariableExpression, VariableType, } from "./types";

const terminating_tokens: TokenType[] = [SemanticType.RightParen, SemanticType.RightBrace, SemanticType.Comma,];

const is_terminating = (tokens: Token[], index: number) => index >= tokens.length || terminating_tokens.includes(tokens[index].type);

type Context = Pick<Func, "body" | "parameters" | "index">;

type ParseContext = {
  index: number;
  contexts: Context[];
  body: Expression;
};

export const parse_tokens = (tokens: Token[], index = 0, min_bind = 0): ParseContext | never => {
  if (index >= tokens.length) {
    console.error("Unexpected end of file");
    exit(1);
  }

  let expression: Expression;
  let contexts: Context[] = [];

  const curr_token = tokens[index];
  switch (curr_token.type) {
    case ValueType.Literal:
      expression = {
        "type": ValueType.Literal,
        "value": curr_token.value,
      };
      break;
    case ValueType.Variable:
      expression = {
        "index": -1,
        "label": curr_token.label,
        "type": ValueType.Variable,
      };
      break;
    case VariableType.ui64:
      expression = {
        "type": VariableType.ui64,
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
      ++index;
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
      const parameters: VariableExpression[] = tokens.slice(index + 1, end_param_index).map((variable, i) => {
        if (variable.type != ValueType.Variable) {
          console.error("ERROR: Non-parameter in parameter list");
          exit(1);
        }
        return {
          "index": -1,
          "label": variable.label,
          "type": ValueType.Variable,
        };
      });
      index = end_param_index + 1;
      if (index >= tokens.length || tokens[index].type != SemanticType.LeftBrace) {
        console.error("ERROR: Missing function body");
        exit(1);
      }
      const parsed = parse_tokens(tokens, index + 1);
      index = parsed.index;
      contexts = [...contexts, ...parsed.contexts, {
        "body": parsed.body,
        index,
        parameters,
      },];
      if (index >= tokens.length || tokens[index].type != SemanticType.RightBrace) {
        console.error("ERROR: Missing closing brace");
        exit(1);
      }
      expression = {
        "func": index,
        "type": MiscType.Function,
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
      }
      expression = {
        "arguments": args,
        "func": expression,
        "type": MiscType.Invocation,
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


const indexify_variables = (expression: Expression, variable_map: Record<string, number> = {}, num_variables = 0): number | never => {
  switch (expression.type) {
    case OperatorType.Colon: {
      const {variable,} = expression;
      variable_map[variable.label] = num_variables;
      variable.index = num_variables;
      return num_variables + 1;
    }
    case OperatorType.Assignment: {
      const {variable, } = expression;
      variable.index = variable_map[variable.label];
      return num_variables;
    }
    case ValueType.Variable: {
      expression.index = variable_map[expression.label];
      return num_variables;
    }
    case ValueType.Literal:
    case MiscType.Function:
      return num_variables;
    case VariableType.ui64:
      console.error("ERROR: non-variable specified as LHS to assignment operator");
      exit(1);
      break;
    case MiscType.Invocation:
      num_variables = indexify_variables(expression.func, variable_map, num_variables);
      // fall through
    default:
      return expression.arguments.reduce((count, expression) =>
          indexify_variables(expression, variable_map, count), num_variables);
  }
};

const indexify_context = (context: Context) => {
  context.parameters.forEach((arg, i) => arg.index = i);
  return indexify_variables(
    context.body,
    context.parameters.reduce((map, {label, }, i) => ({
      ...map,
      [label]: i,
    }), {}),
    context.parameters.length);
};

export const parse = (tokens: Token[]): Func[] => {
  const parsed = parse_tokens(tokens);
  const functions: Func[] = parsed.contexts.map((context) => {
    const num_vars = indexify_context(context);
    return {
      ...context,
      "num_variables": num_vars,
    };
  });
  const num_vars = indexify_variables(parsed.body);

  return [
    {
      "body": parsed.body,
      "index": 0,
      "num_variables": num_vars,
      "parameters": [],
    },
    ...functions,
  ];
};
