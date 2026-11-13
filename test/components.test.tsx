import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeTideReverse, ThemeTideRoot } from "../src/index.js";

describe("web components", () => {
  it("ThemeTideRoot renders its children unchanged", () => {
    expect(
      renderToStaticMarkup(
        <ThemeTideRoot>
          <main>Page</main>
        </ThemeTideRoot>,
      ),
    ).toBe("<main>Page</main>");
  });

  it("ThemeTideReverse marks its child", () => {
    expect(
      renderToStaticMarkup(
        <ThemeTideReverse>
          <button type="button">Light</button>
        </ThemeTideReverse>,
      ),
    ).toBe('<button type="button" data-theme-tide-reverse="">Light</button>');
  });

  it("ThemeTideReverse leaves a disabled child unmarked", () => {
    expect(
      renderToStaticMarkup(
        <ThemeTideReverse disabled>
          <button type="button">Dark</button>
        </ThemeTideReverse>,
      ),
    ).toBe('<button type="button">Dark</button>');
  });
});
