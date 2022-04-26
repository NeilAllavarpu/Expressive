import { exit } from "process";
import { OperatorMap } from "./constants";
import {
  Expression,
  Func,
  MiscType,
  OperatorType,
  SemanticType,
  Token,
  TokenType,
  TypeExpression,
  ValueType,
  VariableExpression,
  VariableType,
} from "./types";

export type Context = Pick<Func, "body" | "parameters" | "index">;

export type ParseContext = {
  index: number;
  contexts: (ParseContext & Context)[];
  body: Expression[];
};

const terminating_tokens: TokenType[] = [
  SemanticType.RightParen,
  SemanticType.RightBrace,
  SemanticType.Comma,
];

const is_terminating = (tokens: Token[], index: number) =>
  index >= tokens.length || terminating_tokens.includes(tokens[index].type);

export const parse_tokens = (
  tokens: Token[],
  index = 0,
  min_bind = 0
): ParseContext | never => {
  if (index >= tokens.length) {
    console.error("Unexpected end of file");
    exit(1);
  }

  let lhs: Expression[];
  let contexts: ParseContext["contexts"] = [];

  const curr_token = tokens[index];
  switch (curr_token.type) {
    case ValueType.Integer:
      lhs = [
        {
          type: ValueType.Integer,
          value: curr_token.integer,
          value_type: VariableType.int,
        },
      ];
      break;
    case ValueType.String:
      lhs = [
        {
          index: -1,
          string: curr_token.string,
          type: ValueType.String,
          value_type: VariableType.str,
        },
      ];
      break;
    case ValueType.Variable:
      lhs = [
        {
          label: curr_token.label,
          type: ValueType.Variable,
          value_type: VariableType.UNDEF,
        },
      ];
      break;
    case VariableType.int:
    case VariableType.str:
    case VariableType.func:
      lhs = [
        {
          type: curr_token.type,
          value_type: VariableType.UNDEF,
        },
      ];
      break;
    case SemanticType.LeftParen: {
      const parsed = parse_tokens(tokens, index + 1);
      lhs = parsed.body;
      index = parsed.index;
      contexts = contexts.concat(parsed.contexts);
      if (
        index >= tokens.length ||
        tokens[index].type !== SemanticType.RightParen
      ) {
        console.error("ERROR: Missing closing parenthesis");
        exit(1);
      }
      break;
    }
    case SemanticType.LeftBrace: {
      // consume parameters
      const end_param_index =
        tokens
          .slice(index + 1)
          .findIndex(({ type }) => type === SemanticType.RightBrace) +
        index +
        1;
      if (end_param_index === index) {
        console.error("ERROR: Missing closing curly brace for parameter list");
        exit(1);
      }
      const parameters: VariableExpression[] = tokens
        .slice(index + 1, end_param_index)
        .map((variable) => {
          if (variable.type !== ValueType.Variable) {
            console.error("ERROR: Non-parameter in parameter list");
            exit(1);
          }
          return {
            label: variable.label,
            type: ValueType.Variable,
            value_type: VariableType.UNDEF,
          };
        });
      index = end_param_index + 1;
      if (
        index >= tokens.length ||
        tokens[index].type !== SemanticType.LeftBrace
      ) {
        console.error("ERROR: Missing function body");
        exit(1);
      }
      const parsed = parse_tokens(tokens, index + 1);
      index = parsed.index;
      contexts = [
        ...contexts,
        {
          body: parsed.body,
          contexts: parsed.contexts,
          index,
          parameters,
        },
      ];
      if (
        index >= tokens.length ||
        tokens[index].type !== SemanticType.RightBrace
      ) {
        console.error("ERROR: Missing closing brace");
        exit(1);
      }
      lhs = [
        {
          func: index,
          type: ValueType.Function,
          value_type: VariableType.func,
        },
      ];
      break;
    }
    default:
      console.error(
        `Unexpected token ${tokens[index].type} (expected expression)`
      );
      exit(1);
  }

  ++index;

  while (!is_terminating(tokens, index)) {
    if (tokens[index].type === SemanticType.LeftParen) {
      // consume arguments
      let args: Expression[][] = [];
      if (tokens[index + 1].type !== SemanticType.RightParen) {
        while (tokens[index].type !== SemanticType.RightParen) {
          const parsed = parse_tokens(tokens, index + 1, 0);
          index = parsed.index;
          contexts = contexts.concat(parsed.contexts);
          if (
            tokens[index].type !== SemanticType.RightParen &&
            tokens[index].type !== SemanticType.Comma
          ) {
            console.error(
              `Unexpected token ${tokens[index].type} (expected closing parenthesis or comma)`
            );
            exit(1);
          }
          args = [...args, parsed.body];
        }
      } else {
        ++index;
      }
      lhs = [
        {
          arguments: args,
          func: lhs,
          type: MiscType.Invocation,
          value_type: VariableType.UNDEF,
        },
      ];
      ++index;
    } else {
      const operator = OperatorMap[tokens[index].type as OperatorType];
      if (operator === undefined) {
        console.error(
          `Unexpected token ${tokens[index].type} (expected operator)`
        );
        exit(1);
      }

      if (operator.left_bind < min_bind) {
        break;
      }
      const parse_result = parse_tokens(tokens, index + 1, operator.right_bind);
      ({ index } = parse_result);
      contexts = contexts.concat(parse_result.contexts);

      switch (operator.operator) {
        case OperatorType.Colon: {
          const [variable] = lhs;
          if (lhs.length !== 1 || variable.type !== ValueType.Variable) {
            throw SyntaxError("Non-variable as LHS to colon operator!");
          }
          const [var_type] = parse_result.body;
          if (
            !Object.values(VariableType).includes(var_type.type as VariableType)
          ) {
            throw SyntaxError(
              "ERROR: non-type specified as RHS to colon operator"
            );
          }
          lhs = [
            {
              type: OperatorType.Colon,
              value_type: VariableType.UNDEF,
              variable,
              variable_type: var_type as TypeExpression,
            },
          ];
          break;
        }
        case OperatorType.Assignment: {
          const [variable] = lhs;
          if (lhs.length !== 1 || variable.type !== ValueType.Variable) {
            throw SyntaxError(
              "ERROR: non-variable specified as LHS to assignment operator"
            );
          }
          lhs = [
            {
              type: OperatorType.Assignment,
              value: parse_result.body,
              value_type: VariableType.UNDEF,
              variable,
            },
          ];
          break;
        }
        case OperatorType.Semicolon: {
          lhs = lhs.concat(parse_result.body);
          break;
        }
        default:
          lhs = [
            {
              arguments: [lhs, parse_result.body],
              type: operator.operator,
              value_type: VariableType.UNDEF,
            },
          ];
      }
    }
  }

  return {
    body: lhs,
    contexts,
    index,
  };
};
