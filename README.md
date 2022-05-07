# Expressive: An expression-based language (ish)

## Types
Types are unchecked.

Boolean: 0 is considered to be false, any other value is considered to be true. Comparisons return either 0 or 1 based on their result. Strings and functions are therefore never false. Unofficial type

Integers: Signed 64 bit integers

Functions: Function expressions that can be invoked, with parameters

Strings: C-like strings. Immutable.

Arrays: Can be of any other type. Immutable, can be indexed and spread.

## Functions

Function expressions are created with the syntax
```
{param1 param2 param3}{
  body;
  return_value
}
```
where the parameters are labels separated by spaces, and the body is a series of expressions. Return values are implicit as the last computed expression value.

Functions can capture outer variables by reference via closures, and can modify them.

## Operators
Documented between `types.ts` and `constants.ts`

Higher bind corresponds to higher operator precedence, with the left-versus-right bind indicating associativity (Pratt parsing).

All binaryoperators except for assignment are left-to-right associative.

| Operator         | Syntax | Description     |
|--------------|-----------|--|
| Parentheses | (\_) | Expression grouping     |
| Invocation | \_(\_) | Function invocation      |
| Indexing | \_[\_] | Array indexing    |
| Spread | ...\_ | Spread operator (array unpacking)   |
| Colon | \_:\_ | Variable declaration  |
| Multiplication | \_*\_ | Signed integer multiplication |
| Division | \_/\_ | Signed integer division |
| Modulus | \_%\_ | Signed Remainder |
| Addition | \_+\_ | Addition |
| Subtraction | \_-\_ | Subtraction |
| Left Shift | \_<<\_ | Logical left bitwise shift |
| Right Shift (Logical) | \_>>\_ | Logical right bitwise shift |
| Right Shift (Arithmetic) | \_>>>\_ | Logical right arithmetic shift |
| Equal | \_==\_ | Equality check |
| Unequal | \_!=\_ | Inequality check |
| Greater | \_>\_ | Greater than check |
| Greater or Equal | \_>=\_ | Greater than or equal to check |
| Less | \_<\_ | Less than check |
| Less or Equal | \_<=\_ | Less than or equal tocheck |
| And | \_&&\_ | Short-circuiting boolean and |
| Or | \_\|\|\_ | Short-circuiting boolean or |
| Assignment | \_=\_ | Variable assignment |
| Range | \_..\_ | Range for subarray indexing |
| Semicolon | \_;\_ | Evaluates and discards LHS; returns value of RHS |

## Builtins

* `print(string, ...format_args)`. Functions similarly to C's `printf`.
* `read_int()`. Reads a single integer from standard input.
* `length(array)`. Returns the length of an array

## Running the compiler
* Install dependencies: `npm i`
* Build the Typescript files: `npm run build`
* Execute the compiler: `npm run execute <input_file> [<output_file]`
  * If no output file is specified, the generated assembly is printed to standard output
* Assemble and link the generated `.s` file with `src/builtins.s` to create an executable
  * If assembling on a non-ARM system, this must be done with `-static`
* Run the executable!
