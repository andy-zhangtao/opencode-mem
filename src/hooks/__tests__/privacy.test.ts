import { test, expect, describe } from "bun:test";
import { stripPrivateTags } from "../privacy";

describe("stripPrivateTags", () => {
  test("removes single private tag and its content", () => {
    const input = "hello <private>secret stuff</private> world";
    expect(stripPrivateTags(input)).toBe("hello  world");
  });

  test("removes multiple private tags", () => {
    const input =
      "start <private>secret1</private> middle <private>secret2</private> end";
    expect(stripPrivateTags(input)).toBe("start  middle  end");
  });

  test("handles multiline content inside private tags", () => {
    const input = "before <private>\nline1\nline2\n</private> after";
    expect(stripPrivateTags(input)).toBe("before  after");
  });

  test("is case-insensitive for tag names", () => {
    const input = "hello <PRIVATE>secret</PRIVATE> world";
    expect(stripPrivateTags(input)).toBe("hello  world");
  });

  test("returns unchanged string when no private tags", () => {
    const input = "nothing private here";
    expect(stripPrivateTags(input)).toBe("nothing private here");
  });

  test("returns empty string for empty input", () => {
    expect(stripPrivateTags("")).toBe("");
  });

  test("handles nested-looking tags (non-greedy match)", () => {
    const input =
      "<private>first</private> visible <private>second</private>";
    expect(stripPrivateTags(input)).toBe(" visible ");
  });

  test("handles unclosed private tag (no match)", () => {
    const input = "hello <private>no closing tag";
    expect(stripPrivateTags(input)).toBe("hello <private>no closing tag");
  });
});
