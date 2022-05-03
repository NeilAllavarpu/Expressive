import { readFile, writeFile } from "fs/promises";
import { exit } from "process";
import { tokenize } from "./tokenize";
import { parse } from "./parse";
import { assemble } from "./assemble";
import { typify_arr } from "./validation";
import { apply_tail_recursion } from "./tail_recursive";
import { register_allocate } from "./register_allocation";

(async () => {
  if (process.argv.length < 3) {
    console.error("Missing input file!");
    exit(1);
  }

  const file_contents = await readFile(process.argv[2], {
    encoding: "utf8",
  });

  const tokens = tokenize(file_contents);
  const expression_tree = parse(tokens);

  expression_tree.functions = Object.entries(expression_tree.functions)
    .map(([index, func]) => {
      typify_arr(func.body, func.variables);
      apply_tail_recursion(func);
      func = register_allocate(func);
      return { func, index };
    })
    .reduce(
      (tree, { index, func }) => ({
        ...tree,
        [index]: func,
      }),
      {}
    );

  const assembly = assemble(expression_tree);
  if (process.argv.length === 3) {
    console.log(assembly);
  } else {
    await writeFile(process.argv[3], assembly);
  }
})();
