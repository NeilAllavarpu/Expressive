import {OperatorType, SemanticType, Token, ValueType, VariableType,} from "./types";

const is_numeric = (string: string, position: number) => {
  const code = string.charCodeAt(position);
  return "0".charCodeAt(0) <= code && code <= "9".charCodeAt(0);
};

const is_alphabetic = (string: string, position: number) => {
  const code = string.charCodeAt(position);
  return ("a".charCodeAt(0) <= code && code <= "z".charCodeAt(0)) ||
         ("A".charCodeAt(0) <= code && code <= "Z".charCodeAt(0));
};

const is_alphanumeric = (string: string, position: number) => {
  return is_alphabetic(string, position) || is_numeric(string, position);
};

const is_whitespace = (string: string, position: number) => {
  const code = string.charCodeAt(position);
  return code == " ".charCodeAt(0) || code == "\n".charCodeAt(0);
};

export const tokenize = (program: string) => {
  let position = 0;
  const tokens: Token[] = [];
  const token_type_list = [
    ...Object.values(OperatorType),
    ...Object.values(SemanticType),
    ...Object.values(VariableType),
  ];
  while (position < program.length) {
    const token_type = token_type_list.find(
      (str) => program.startsWith(str, position)
    );
    if (token_type !== undefined) {
      tokens.push({
        "type": token_type,
      });
      position += token_type.length;
    } else if (is_alphabetic(program, position)) {
      let identifier_length = 1;
      while (is_alphanumeric(program, position + identifier_length)) {
        ++identifier_length;
      }

      tokens.push({
        "label": program.substring(position, position + identifier_length),
        "type": ValueType.Variable,
      });
      position += identifier_length;
    } else if (is_numeric(program, position)) {
      let value = 0;
      while (is_numeric(program, position)) {
        value = value * 10 + (program.charCodeAt(position) - "0".charCodeAt(0));
        ++position;
      }

      tokens.push({
        "type": ValueType.Literal,
        "value": value,
      });
    } else if (is_whitespace(program, position)) {
      ++position;
    } else {
      console.error(`Invalid character ${program.charAt(position)} (at character ${position})`);
      ++position;
    }
  }
  return tokens;
};
