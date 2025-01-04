import { ActionContext } from "@/src/ActionContext.js";
import { AtpAgent } from "@atproto/api";

type Props = {
  $: ActionContext;
  handle?: string;
  password?: string;
  serviceUrl?: string;
};

export const getAgent = async (props: Props): Promise<AtpAgent> => {
  const defaultServiceUrl =
    props.handle && props.password
      ? "https://bsky.social"
      : "https://public.api.bsky.app";

  const agent = new AtpAgent({
    service: props.serviceUrl || defaultServiceUrl,
    fetch: props.$.fetch,
  });
  if (props.handle && props.password) {
    await agent.login({
      identifier: props.handle,
      password: props.password,
    });
  }
  return agent;
};
