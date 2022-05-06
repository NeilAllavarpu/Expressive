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
  SemanticType.RightBracket,
  SemanticType.Comma,
];

const is_terminating = (tokens: Token[], index: number) =>
  index >= tokens.length || terminating_tokens.includes(tokens[index].type);

const parse_expression_list = (
  tokens: Token[],
  index: number,
  closing_token: SemanticType
): {
  index: number;
  contexts: (ParseContext & Context)[];
  args: Expression[][];
} => {
  // consume arguments
  let args: Expression[][] = [];
  let contexts: ParseContext["contexts"] = [];
  if (tokens[index + 1].type === closing_token) {
    return {
      args,
      contexts,
      index: index + 1,
    };
  }
  while (tokens[index].type !== closing_token) {
    const parsed = parse_tokens(tokens, index + 1, 0);
    index = parsed.index;
    contexts = contexts.concat(parsed.contexts);
    if (
      tokens[index].type !== closing_token &&
      tokens[index].type !== SemanticType.Comma
    ) {
      throw SyntaxError(
        `Unexpected token ${tokens[index].type} (expected closing parenthesis or comma)`
      );
    }
    args = [...args, parsed.body];
  }
  return {
    args,
    contexts,
    index,
  };
};

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
      {
        let type_expression: TypeExpression = {
          type: curr_token.type,
          value_type: VariableType.UNDEF,
        };
        while (tokens[index + 1].type === SemanticType.LeftBracket) {
          if (tokens[index + 2].type !== SemanticType.RightBracket) {
            throw SyntaxError(
              "Missing closing `[` in array type specification"
            );
          }
          type_expression = {
            of: type_expression,
            type: VariableType.arr,
            value_type: VariableType.arr,
          };
          index += 2;
        }
        lhs = [type_expression];
      }
      break;
    case SemanticType.Ellipsis: {
      const parsed = parse_tokens(tokens, index + 1);
      lhs = [
        {
          array: parsed.body,
          type: MiscType.Spread,
          value_type: VariableType.UNDEF,
        },
      ];
      index = parsed.index - 1;
      contexts = contexts.concat(parsed.contexts);
      break;
    }
    case SemanticType.LeftBracket:
      {
        const arg_list = parse_expression_list(
          tokens,
          index,
          SemanticType.RightBracket
        );
        index = arg_list.index;
        lhs = [
          {
            arguments: arg_list.args,
            type: ValueType.Array,
            value_type: VariableType.arr,
          },
        ];
      }
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
        index >= tokens.length - 1 ||
        tokens[index].type !== SemanticType.LeftBrace
      ) {
        console.error("ERROR: Missing function body");
        exit(1);
      }
      if (tokens[index + 1].type === SemanticType.RightBrace) {
        index += 1;
        contexts = [
          ...contexts,
          {
            body: [],
            contexts: [],
            index,
            parameters,
          },
        ];
      } else {
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
      }
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
      const arg_list = parse_expression_list(
        tokens,
        index,
        SemanticType.RightParen
      );
      index = arg_list.index + 1;
      contexts = contexts.concat(arg_list.contexts);
      lhs = [
        {
          arguments: arg_list.args,
          func: lhs,
          is_tail_call: false,
          type: MiscType.Invocation,
          value_type: VariableType.UNDEF,
        },
      ];
    } else if (tokens[index].type === SemanticType.LeftBracket) {
      const parse_result = parse_tokens(tokens, index + 1, 0);
      ({ index } = parse_result);
      if (tokens[index].type !== SemanticType.RightBracket) {
        throw SyntaxError("Missing closing bracket for array indexing");
      }
      if (parse_result.body.length === 0) {
        throw SyntaxError("Empty array index");
      }
      index = index + 1;
      contexts = contexts.concat(parse_result.contexts);
      const final_value = parse_result.body.at(-1);
      if (final_value?.type === OperatorType.IndexRange) {
        lhs = [
          ...parse_result.body.slice(0, -1),
          {
            ...final_value,
            array: lhs,
          },
        ];
      } else {
        lhs = [
          {
            array: lhs,
            index: parse_result.body,
            type: MiscType.Indexing,
            value_type: VariableType.UNDEF,
          },
        ];
      }
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
        case OperatorType.IndexRange: {
          lhs = [
            {
              array: [],
              index_hi: parse_result.body,
              index_lo: lhs,
              type: OperatorType.IndexRange,
              value_type: VariableType.UNDEF,
            },
          ];
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
