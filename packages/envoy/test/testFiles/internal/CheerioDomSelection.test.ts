import { CheerioDomSelection, normaliseDomSelector } from "@/src/index.js";
import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

const html = `<!doctype html>
<html>
  <head>
    <title>Cheerio Selection Test</title>
    <link rel="canonical" href="https://example.test/canonical" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"One"}</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Thing","name":"Two"}</script>
  </head>
  <body>
    <div id="container" class="root wrap" data-kind="root" data-count="2">
      <section class="group alpha" data-section="a">
        <article id="first" class="item selected" data-id="1">
          <h1 class="title">Heading</h1>
          <p class="summary">Summary text</p>
          <a class="link" href="/one">One</a>
        </article>
        <article id="second" class="item" data-id="2">
          <h2 class="title">Second</h2>
          <p class="summary">Second summary</p>
          <a class="link" href="/two">Two</a>
        </article>
      </section>
      <input id="name" value="Alice" />
      <select id="choices" multiple>
        <option value="a" selected>A</option>
        <option value="b">B</option>
        <option value="c" selected>C</option>
      </select>
    </div>
  </body>
</html>`;

function createRoot(): CheerioDomSelection {
  return new CheerioDomSelection(cheerio.load(html));
}

function assertNode<T>(value: T | null): T {
  expect(value).not.toBeNull();
  if (value === null) {
    throw new Error("Expected node to exist");
  }

  return value;
}

describe("normaliseDomSelector", () => {
  it("normalises string, prefixed string, numeric and object selectors", () => {
    expect(normaliseDomSelector("#id")).toEqual({ type: "css", query: "#id" });
    expect(normaliseDomSelector("css=.item")).toEqual({
      type: "css",
      query: ".item",
    });
    expect(normaliseDomSelector("xpath=//div")).toEqual({
      type: "xpath",
      query: "//div",
    });
    expect(normaliseDomSelector(-1)).toEqual({ type: "nth", query: -1 });
    expect(normaliseDomSelector({ type: "css", query: ".x" })).toEqual({
      type: "css",
      query: ".x",
    });
  });
});

describe("CheerioDomSelection", () => {
  it("covers traversal methods and selection getters", () => {
    const root = createRoot();
    const items = root.get(".item");
    const firstTitle = assertNode(items.getFirst(".title"));
    const firstTitleArticle = assertNode(firstTitle.closest("article"));
    const firstArticle = assertNode(root.getFirst("#first"));
    const secondArticle = assertNode(root.getFirst("#second"));
    const container = assertNode(root.getFirst("#container"));
    const firstItem = assertNode(items.first());
    const lastItem = assertNode(items.last());
    const firstFiltered = assertNode(
      items.first({ type: "css", query: "#second" }),
    );
    const lastFiltered = assertNode(
      items.last({ type: "css", query: "#first" }),
    );
    const previousSibling = assertNode(secondArticle.previousSibling);
    const nextSibling = assertNode(firstArticle.nextSibling);
    const parent = assertNode(firstArticle.parent);

    expect(items.length).toBe(2);
    expect(items.get(0).map((node) => node.attr("class"))).toEqual([
      "title",
      "title",
    ]);
    expect(items.get(1).map((node) => node.attr("class"))).toEqual([
      "summary",
      "summary",
    ]);
    expect(items.get(-1).map((node) => node.attr("class"))).toEqual([
      "link",
      "link",
    ]);
    expect(items.get(-2).map((node) => node.attr("class"))).toEqual([
      "summary",
      "summary",
    ]);

    expect(
      items.filter({ type: "nth", query: 0 }).map((n) => n.attr("id")),
    ).toEqual(["first"]);
    expect(
      items.filter({ type: "nth", query: -1 }).map((n) => n.attr("id")),
    ).toEqual(["second"]);

    expect(firstTitle.text).toBe("Heading");
    expect(root.get(".summary").length).toBe(2);
    expect(items.get("#first").length).toBe(0);
    expect(items.anyMatches(".item")).toBe(true);
    expect(items.allMatches(".item")).toBe(true);
    expect(items.allMatches("#first")).toBe(false);
    expect(firstTitleArticle.attr("id")).toBe("first");
    expect(firstArticle.hasClass("selected")).toBe(true);
    expect(firstArticle.attr("data-id")).toBe("1");
    expect(firstArticle.attrs).toMatchObject({
      id: "first",
      "data-id": "1",
    });
    expect(root.exists(".group.alpha")).toBe(true);
    expect(root.exists("xpath=//article")).toBe(true);

    expect(container.children.length).toBeGreaterThan(0);
    expect(parent.hasClass("group")).toBe(true);
    expect(firstArticle.parents.anyMatches("body")).toBe(true);
    expect(firstArticle.siblings.length).toBe(1);
    expect(previousSibling.attr("id")).toBe("first");
    expect(nextSibling.attr("id")).toBe("second");
    expect(firstItem.attr("id")).toBe("first");
    expect(lastItem.attr("id")).toBe("second");
    expect(firstFiltered.attr("id")).toBe("second");
    expect(lastFiltered.attr("id")).toBe("first");
    expect(root.getFirst("#does-not-exist")).toBeNull();
    expect(items.first({ type: "css", query: "#does-not-exist" })).toBeNull();
    expect(firstArticle.previousSibling).toBeNull();

    expect(root.get("#container").get(".link").length).toBe(2);
    expect(root.get("#container").map((node) => node.attr("id"))).toEqual([
      "container",
    ]);
  });

  it("covers content and metadata getters", () => {
    const root = createRoot();
    const container = assertNode(root.getFirst("#container"));
    const first = assertNode(root.getFirst("#first"));
    const name = assertNode(root.getFirst("#name"));
    const choices = assertNode(root.getFirst("#choices"));

    expect(container.text).toContain("Heading");
    expect(first.html).toContain("Summary text");
    expect(root.get("#first").nodes).toHaveLength(1);

    expect(container.data).toMatchObject({
      kind: "root",
      count: 2,
    });
    expect(name.value).toBe("Alice");
    expect(choices.value).toEqual(["A", "C"]);
  });

  it("supports xpath selectors", () => {
    const root = createRoot();
    const first = assertNode(root.getFirst("xpath=//*[@id='first']"));

    expect(root.get("xpath=//article").length).toBe(2);
    expect(root.anyMatches("xpath=//article")).toBe(true);
    expect(first.attr("id")).toBe("first");
  });
});
