import type { Source } from "@/src/schemas/source.js";
import feedReqHandler from "./requestHandlers/feed.js";
import mediaSearchReqHandler from "./requestHandlers/mediaSearch.js";
import singleMediaReqHandler from "./requestHandlers/singleMedia.js";
import userFeedReqHandler from "./requestHandlers/userFeed.js";
import { sourceId } from "./shared.js";

export default {
  id: sourceId,
  displayName: "Bluesky",
  description: "A decentralised twitter-like social network",
  requestHandlers: [
    singleMediaReqHandler,
    mediaSearchReqHandler,
    feedReqHandler,
    userFeedReqHandler,
  ],
} satisfies Source;
