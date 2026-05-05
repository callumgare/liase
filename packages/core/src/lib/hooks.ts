// biome-ignore lint/suspicious/noExplicitAny: hooks pipeline passes arbitrary data between middleware
export type Hook = (input: any, next: (output: any) => any) => any;

export type LiasonHooks = {
  loadUrl: Array<Hook>;
  getFetchClient: Array<Hook>;
};

// biome-ignore lint/suspicious/noExplicitAny: hooks pipeline passes arbitrary data between middleware
export async function executeHooks(input: any, hooks: Array<Hook>) {
  const hooksIterator = hooks.values();
  // biome-ignore lint/suspicious/noExplicitAny: hooks pipeline passes arbitrary data between middleware
  async function runNextHook(input: any): Promise<any> {
    const nextHook = hooksIterator.next().value;
    if (!nextHook) {
      return input;
    }
    return nextHook(await input, runNextHook);
  }
  return await runNextHook(await input);
}
