export type Hook = (input: any, next: (output: any) => any) => any;

export type MediaFinderHooks = {
  loadUrl: Array<Hook>;
  getFetchClient: Array<Hook>;
};

export async function executeHooks(input: any, hooks: Array<Hook>) {
  const hooksIterator = hooks.values();
  async function runNextHook(input: any): Promise<any> {
    const nextHook = hooksIterator.next().value;
    if (!nextHook) {
      return input;
    }
    return nextHook(await input, runNextHook);
  }
  return await runNextHook(await input);
}
