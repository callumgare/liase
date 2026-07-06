import { vitestSetupCachingProxy } from "@liase/core/testing/setup";

export default async function (context: {
  provide: (key: string, value: unknown) => void;
}) {
  const cleanup = await vitestSetupCachingProxy(context);

  return async () => {
    await cleanup();
  };
}
