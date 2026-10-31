// --key=value / --flag command line arguments.
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  argv.forEach((arg) => {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) {
      args[match[1]] = match[2] === undefined ? true : match[2];
    }
  });
  return args;
}
