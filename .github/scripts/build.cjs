const { spawnSync } = require('node:child_process');
const result = spawnSync('npm', ['run', 'dist:mac'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
let output = (result.stdout || '') + (result.stderr || '');
for (const name of ['GITHUB_TOKEN', 'GH_TOKEN', 'ACTIONS_RUNTIME_TOKEN']) {
  if (process.env[name]) output = output.replaceAll(process.env[name], '[REDACTED]');
}
process.stdout.write(output);
if (result.status !== 0) {
  const errorLines = output.split('\n').filter(line => /⨯|Error:|failed|ENOENT|EACCES|not found|error/i.test(line));
  const message = (errorLines.length ? errorLines.slice(-8).join('\n') : 'Mac build failed; see signed-in workflow logs.').slice(0, 5000);
  console.log('::error title=Mac packaging diagnosis::' + message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A'));
  process.exit(result.status || 1);
}
