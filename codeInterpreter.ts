import { CodeInterpreter } from "@e2b/code-interpreter";

export async function codeInterpret(
  codeInterpreter: CodeInterpreter,
  code: string
) {
  console.log(
    `\n${"=".repeat(50)}\n> Running following AI-generated code:
    \n${code}\n${"=".repeat(50)}`
  );

  const exec = await codeInterpreter.notebook.execCell(code);

  if (exec.error) {
    console.log("[Code Interpreter error]", exec.error); // Runtime error
    return undefined;
  }

  return exec;
}
