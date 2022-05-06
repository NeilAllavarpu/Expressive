import {
  OperatorType,
  SemanticType,
  Token,
  ValueType,
  VariableType,
} from "./types";

const is_numeric = (string: string, position: number) => {
  const char = string.charAt(position);
  return "0" <= char && char <= "9";
};

const is_alphabetic = (string: string, position: number) => {
  const char = string.charAt(position);
  return ("a" <= char && char <= "z") || ("A" <= char && char <= "Z");
};

const is_alphanumeric = (string: string, position: number) =>
  is_alphabetic(string, position) ||
  is_numeric(string, position) ||
  string.charAt(position) === "_";

const is_whitespace = (string: string, position: number) => {
  const code = string.charAt(position);
  return code === " " || code === "\n";
};

export const tokenize = (program: string) => {
  let position = 0;
  const tokens: Token[] = [];
  const token_type_list = [
    ...Object.values(OperatorType),
    ...Object.values(SemanticType),
    ...Object.values(VariableType),
  ].sort((op1, op2) => op2.length - op1.length);
  while (position < program.length) {
    if (program.charAt(position) === '"') {
      const closing_quote_index = program.indexOf('"', position + 1);
      tokens.push({
        string: program.substring(position + 1, closing_quote_index),
        type: ValueType.String,
      });
      position = closing_quote_index + 1;
    } else if (is_numeric(program, position)) {
      let value = 0;
      while (is_numeric(program, position)) {
        value = value * 10 + (program.charCodeAt(position) - "0".charCodeAt(0));
        ++position;
      }

      tokens.push({
        integer: value,
        type: ValueType.Integer,
      });
    } else if (is_whitespace(program, position)) {
      ++position;
    } else if (is_alphabetic(program, position)) {
      let identifier_length = 1;
      while (is_alphanumeric(program, position + identifier_length)) {
        ++identifier_length;
      }
      const identifier = program.substring(
        position,
        position + identifier_length
      );
      if (
        token_type_list.includes(
          identifier as OperatorType | SemanticType | VariableType
        )
      ) {
        tokens.push({
          type: identifier as OperatorType | SemanticType | VariableType,
        });
      } else {
        tokens.push({
          label: identifier,
          type: ValueType.Variable,
        });
      }
      position += identifier_length;
    } else {
      const token_type = token_type_list.find((str) =>
        program.startsWith(str, position)
      );
      if (token_type !== undefined) {
        tokens.push({
          type: token_type,
        });
        position += token_type.length;
      } else {
        console.error(
          `Invalid character ${program.charAt(
            position
          )} (at character ${position})`
        );

        ++position;
      }
    }
  }
  return tokens;
};
