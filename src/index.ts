import {readFile, writeFile,} from "fs/promises";
import {exit,} from "process";
import {tokenize,} from "./tokenize";
import {parse,} from "./parse";
import {assemble,} from "./assemble";

(async () => {
  if (process.argv.length < 3) {
    console.error("Missing input file!");
    exit(1);
  }

  const file_contents = await readFile(process.argv[2], {
    "encoding": "utf8",
  });

  const tokens = tokenize(file_contents);
  const expression_tree = parse(tokens);
  const assembly = assemble(expression_tree);
  if (process.argv.length == 3) {
    console.log(assembly);
  } else {
    writeFile(process.argv[3], assembly);
  }
})();
