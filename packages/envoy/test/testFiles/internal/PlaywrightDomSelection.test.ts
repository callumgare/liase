import { type Server, createServer } from "node:http";
import { envoy } from "@/src/envoy.js";
import { shutdownBrowser } from "@/src/lib/playwrightBrowser.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const callCtx = { cacheNetworkRequests: "never" as const };
const boundEnvoy = envoy.bind(callCtx) as typeof envoy;

let server: Server;
let serverUrl: string;

function startServer() {
  return new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      if (req.url === "/next") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<!doctype html><html><head><title>Next</title></head><body><h1 id="next">Next page</h1></body></html>`,
        );
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!doctype html>
<html>
  <head>
    <title>Playwright Selection Test</title>
    <link rel="canonical" href="https://example.test/playwright" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Selection"}</script>
  </head>
  <body>
    <div id="root" class="root" data-kind="root">
      <div id="a" class="item selected" data-id="1">
        <span class="name">Alpha</span>
      </div>
      <div id="b" class="item" data-id="2">
        <span class="name">Beta</span>
      </div>
      <a id="nav" href="/next">Go next</a>
      <input id="input" type="text" value="seed" />
      <textarea id="notes">hello</textarea>
      <input id="checkbox" type="checkbox" checked />
      <input id="disabled" type="text" disabled value="nope" />
      <select id="select">
        <option value="one">One</option>
        <option value="two">Two</option>
      </select>
      <button id="btn" onclick="window.__clicks=(window.__clicks||0)+1">click</button>
      <button id="dbl" ondblclick="window.__dbl=(window.__dbl||0)+1">double</button>
      <button id="show" onclick="setTimeout(() => document.getElementById('late').style.display='block', 50)">show</button>
      <div id="late" style="display:none">later</div>
      <div id="far" style="margin-top:2000px">far</div>
    </div>
  </body>
</html>`);
    }).listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function assertNode<T>(value: T | null): T {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error("Expected node to exist");
  }

  return value;
}

describe("PlaywrightDomSelection", () => {
  beforeEach(async () => {
    await startServer();
    await shutdownBrowser();
  });

  afterEach(async () => {
    await shutdownBrowser();
    await stopServer();
  });

  it("covers traversal and non-interactive getters", async () => {
    const result = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const root = await result.dom;
    const items = root.get(".item");
    const firstName = assertNode(items.getFirst(".name"));
    const nestedName = assertNode(root.getFirst("#a .name"));
    const nestedNameClosestA = assertNode(nestedName.closest("#a"));
    const nodeA = assertNode(root.getFirst("#a"));
    const nodeB = assertNode(root.getFirst("#b"));
    const rootFirst = assertNode(root.first());
    const nodeARootParent = assertNode(nodeA.parent);
    const nodeAFirstChild = assertNode(nodeA.children.first());
    const nodeBPreviousSibling = assertNode(nodeB.previousSibling);
    const nodeANextSibling = assertNode(nodeA.nextSibling);
    const itemsFirst = assertNode(items.first());
    const itemsLast = assertNode(items.last());
    const itemsFilteredFirst = assertNode(
      items.first({ type: "css", query: "#b" }),
    );
    const itemsFilteredLast = assertNode(
      items.last({ type: "css", query: "#a" }),
    );
    const rootNode = assertNode(root.getFirst("#root"));
    const inputNode = assertNode(root.getFirst("#input"));

    expect(items.length).toBe(2);
    expect(items.get(0).map((node) => node.attr("class"))).toEqual([
      "name",
      "name",
    ]);
    expect(items.get(-1).map((node) => node.attr("class"))).toEqual([
      "name",
      "name",
    ]);
    expect(
      items.filter({ type: "nth", query: 0 }).map((n) => n.attr("id")),
    ).toEqual(["a"]);
    expect(firstName.text).toBe("Alpha");
    expect(root.get(".name").length).toBe(2);
    expect(items.get("#a").length).toBe(0);
    expect(items.anyMatches(".item")).toBe(true);
    expect(items.allMatches(".item")).toBe(true);
    expect(items.allMatches("#a")).toBe(false);
    expect(nestedNameClosestA.attr("id")).toBe("a");
    expect(nodeA.hasClass("selected")).toBe(true);
    expect(nodeA.attrs).toMatchObject({
      id: "a",
      "data-id": "1",
    });
    expect(root.exists("#b")).toBe(true);

    expect(rootFirst.text).toContain("Playwright Selection Test");
    expect(rootFirst.html).toContain('id="root"');
    expect(root.nodes).toHaveLength(1);
    expect(nodeARootParent.attr("id")).toBe("root");
    expect(nodeA.parents.anyMatches("body")).toBe(true);
    expect(nodeAFirstChild.text).toBe("Alpha");
    expect(nodeA.siblings.length).toBeGreaterThan(1);
    expect(nodeBPreviousSibling.attr("id")).toBe("a");
    expect(nodeANextSibling.attr("id")).toBe("b");
    expect(itemsFirst.attr("id")).toBe("a");
    expect(itemsLast.attr("id")).toBe("b");
    expect(itemsFilteredFirst.attr("id")).toBe("b");
    expect(itemsFilteredLast.attr("id")).toBe("a");
    expect(root.getFirst("#missing")).toBeNull();
    expect(items.first({ type: "css", query: "#missing" })).toBeNull();
    expect(nodeA.previousSibling).toBeNull();

    expect(await result.firstJsonLD).toMatchObject({ "@type": "WebPage" });
    expect(await result.jsonLD).toHaveLength(1);
    expect(await result.canonicalUrl).toBe("https://example.test/playwright");
    expect(rootNode.data).toMatchObject({ kind: "root" });
    expect(inputNode.value).toBe("seed");

    expect(root.get(".item").length).toBe(2);
    expect(root.get(".item").map((n) => n.attr("id"))).toEqual(["a", "b"]);

    await result.close();
  });

  it("covers interactive methods and async state getters", async () => {
    const result = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const root = await result.dom;
    const btn = assertNode(root.getFirst("#btn"));
    const dbl = assertNode(root.getFirst("#dbl"));
    const input = assertNode(root.getFirst("#input"));
    const notes = assertNode(root.getFirst("#notes"));
    const select = assertNode(root.getFirst("#select"));
    const far = assertNode(root.getFirst("#far"));
    const show = assertNode(root.getFirst("#show"));
    const late = assertNode(root.getFirst("#late"));
    const nodeA = assertNode(root.getFirst("#a"));
    const disabled = assertNode(root.getFirst("#disabled"));
    const checkbox = assertNode(root.getFirst("#checkbox"));

    await btn.click();
    await dbl.dblclick();

    await input.fill("abc");
    expect(await input.inputValue()).toBe("abc");

    await input.clear();
    expect(await input.inputValue()).toBe("");

    await input.type("typed", { delay: 1 });
    await input.press("End");
    await input.pressSequentially("!", { delay: 1 });
    expect(await input.inputValue()).toBe("typed!");

    await notes.focus();
    await notes.blur();
    await notes.hover();

    await select.selectOption("two");
    expect(await select.inputValue()).toBe("two");

    await far.scrollIntoViewIfNeeded();

    await show.click();
    await late.waitFor({ state: "visible", timeout: 5000 });

    expect(await btn.getAttribute("id")).toBe("btn");
    expect(await notes.textContent()).toBe("hello");
    expect(await btn.innerText()).toBe("click");
    expect(await nodeA.innerHtml()).toContain("Alpha");

    expect(await btn.isVisible()).toBe(true);
    expect(await late.isHidden()).toBe(false);
    expect(await btn.isEnabled()).toBe(true);
    expect(await disabled.isDisabled()).toBe(true);
    expect(await input.isEditable()).toBe(true);
    expect(await checkbox.isChecked()).toBe(true);

    await result.close();
  });

  it("supports xpath selector syntax and navigation with waitForUrl", async () => {
    const result = await boundEnvoy(serverUrl, {
      agent: "playwright",
      responseType: "rendered dom",
    });

    const root = await result.dom;
    const nav = assertNode(
      root.getFirst({ type: "xpath", query: "//a[@id='nav']" }),
    );
    const navPromise = result.waitForUrl();
    await nav.click();
    await navPromise;

    expect(await result.html()).toContain("Next page");
    expect(await result.title()).toBe("Next");

    await result.close();
  });
});
