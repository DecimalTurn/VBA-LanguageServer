import { execSync } from 'child_process';
import { resolve, dirname } from 'path';

const grammars = [
  { file: './server/src/antlr/vba.g4', output: './server/src/antlr/out/' },
  { file: './server/src/antlr/vbapre.g4', output: './server/src/antlr/out/' }
];

grammars.forEach(({ file, output }) => {
  // Resolve the absolute path for the grammar file and output directory
  const grammarFilePath = resolve(file);
  const outputDirPath = resolve(output);

  console.log(`Generating parser for ${grammarFilePath} to ${outputDirPath}`);

  // Construct the command with absolute paths
  const command = `antlr4ng -Dlanguage=TypeScript -visitor ${grammarFilePath} -o ${outputDirPath}`;
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit' });
});