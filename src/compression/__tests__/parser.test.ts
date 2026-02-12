import { test, expect, describe } from "bun:test";
import { parseObservations, parseSummary } from "../parser";

describe("parseObservations", () => {
  test("extracts single observation from XML", () => {
    const xml = `
      <observation>
        <type>tool_use</type>
        <title>Listed files in project</title>
        <subtitle>bash command execution</subtitle>
        <facts>
          <fact>Found 5 TypeScript files</fact>
          <fact>Project uses Bun runtime</fact>
        </facts>
        <narrative>Executed ls command to enumerate project files</narrative>
        <concepts>
          <concept>file-system</concept>
          <concept>project-structure</concept>
        </concepts>
        <files_read>
          <file>src/index.ts</file>
        </files_read>
        <files_modified></files_modified>
      </observation>
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(1);
    expect(observations[0].type).toBe("tool_use");
    expect(observations[0].title).toBe("Listed files in project");
    expect(observations[0].subtitle).toBe("bash command execution");
    expect(observations[0].facts).toEqual([
      "Found 5 TypeScript files",
      "Project uses Bun runtime",
    ]);
    expect(observations[0].narrative).toBe(
      "Executed ls command to enumerate project files"
    );
    expect(observations[0].concepts).toEqual([
      "file-system",
      "project-structure",
    ]);
    expect(observations[0].files_read).toEqual(["src/index.ts"]);
    expect(observations[0].files_modified).toEqual([]);
  });

  test("extracts multiple observations", () => {
    const xml = `
      <observation>
        <type>tool_use</type>
        <title>Read configuration</title>
        <facts><fact>Config has 3 fields</fact></facts>
        <narrative>Read config file</narrative>
        <concepts><concept>configuration</concept></concepts>
        <files_read><file>config.json</file></files_read>
        <files_modified></files_modified>
      </observation>
      <observation>
        <type>code_change</type>
        <title>Updated handler</title>
        <facts><fact>Added error handling</fact></facts>
        <narrative>Modified request handler</narrative>
        <concepts><concept>error-handling</concept></concepts>
        <files_read></files_read>
        <files_modified><file>src/handler.ts</file></files_modified>
      </observation>
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(2);
    expect(observations[0].type).toBe("tool_use");
    expect(observations[0].title).toBe("Read configuration");
    expect(observations[1].type).toBe("code_change");
    expect(observations[1].title).toBe("Updated handler");
    expect(observations[1].files_modified).toEqual(["src/handler.ts"]);
  });

  test("handles missing optional fields gracefully", () => {
    const xml = `
      <observation>
        <type>discovery</type>
        <title>Found pattern</title>
        <facts></facts>
        <narrative></narrative>
        <concepts></concepts>
        <files_read></files_read>
        <files_modified></files_modified>
      </observation>
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(1);
    expect(observations[0].type).toBe("discovery");
    expect(observations[0].title).toBe("Found pattern");
    expect(observations[0].facts).toEqual([]);
    expect(observations[0].narrative).toBeNull();
    expect(observations[0].concepts).toEqual([]);
    expect(observations[0].files_read).toEqual([]);
    expect(observations[0].files_modified).toEqual([]);
  });

  test("handles malformed XML without throwing", () => {
    const badXml = "<observation><type>incomplete";
    const result = parseObservations(badXml);
    expect(result).toBeArray();
    expect(result).toHaveLength(0);
  });

  test("handles completely invalid input", () => {
    const result = parseObservations("not xml at all, just random text");
    expect(result).toBeArray();
    expect(result).toHaveLength(0);
  });

  test("handles empty string input", () => {
    const result = parseObservations("");
    expect(result).toBeArray();
    expect(result).toHaveLength(0);
  });

  test("handles observation with missing type using fallback", () => {
    const xml = `
      <observation>
        <title>Something happened</title>
        <facts><fact>A fact</fact></facts>
        <narrative>Description</narrative>
        <concepts></concepts>
        <files_read></files_read>
        <files_modified></files_modified>
      </observation>
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(1);
    expect(observations[0].type).toBeTruthy();
    expect(observations[0].title).toBe("Something happened");
  });

  test("handles nested XML-like content in facts", () => {
    const xml = `
      <observation>
        <type>discovery</type>
        <title>Found code pattern</title>
        <facts>
          <fact>File contains &lt;div&gt; elements</fact>
        </facts>
        <narrative>Analyzed template</narrative>
        <concepts><concept>html</concept></concepts>
        <files_read><file>template.html</file></files_read>
        <files_modified></files_modified>
      </observation>
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(1);
    expect(observations[0].facts).toHaveLength(1);
  });

  test("trims whitespace from extracted fields", () => {
    const xml = `
      <observation>
        <type>  tool_use  </type>
        <title>
          Spaced title
        </title>
        <facts>
          <fact>  fact with spaces  </fact>
        </facts>
        <narrative>  narrative  </narrative>
        <concepts>
          <concept>  concept  </concept>
        </concepts>
        <files_read></files_read>
        <files_modified></files_modified>
      </observation>
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(1);
    expect(observations[0].type).toBe("tool_use");
    expect(observations[0].title).toBe("Spaced title");
    expect(observations[0].facts).toEqual(["fact with spaces"]);
    expect(observations[0].narrative).toBe("narrative");
    expect(observations[0].concepts).toEqual(["concept"]);
  });

  test("observations surrounded by other text", () => {
    const xml = `
      Some preamble text that isn't XML.
      <observation>
        <type>tool_use</type>
        <title>Embedded observation</title>
        <facts><fact>Fact 1</fact></facts>
        <narrative>Found in mixed content</narrative>
        <concepts></concepts>
        <files_read></files_read>
        <files_modified></files_modified>
      </observation>
      Some trailing text.
    `;

    const observations = parseObservations(xml);

    expect(observations).toHaveLength(1);
    expect(observations[0].title).toBe("Embedded observation");
  });
});

describe("parseSummary", () => {
  test("extracts all summary fields", () => {
    const xml = `
      <summary>
        <request>Implement user authentication</request>
        <investigated>Checked existing auth patterns</investigated>
        <learned>JWT tokens are preferred</learned>
        <completed>Added login endpoint</completed>
        <next_steps>Add token refresh</next_steps>
        <notes>Consider rate limiting</notes>
      </summary>
    `;

    const summary = parseSummary(xml);

    expect(summary).not.toBeNull();
    expect(summary!.request).toBe("Implement user authentication");
    expect(summary!.investigated).toBe("Checked existing auth patterns");
    expect(summary!.learned).toBe("JWT tokens are preferred");
    expect(summary!.completed).toBe("Added login endpoint");
    expect(summary!.next_steps).toBe("Add token refresh");
    expect(summary!.notes).toBe("Consider rate limiting");
  });

  test("returns null when no summary tag found", () => {
    const result = parseSummary("No summary here, just text");
    expect(result).toBeNull();
  });

  test("returns null for empty string", () => {
    const result = parseSummary("");
    expect(result).toBeNull();
  });

  test("handles missing optional fields", () => {
    const xml = `
      <summary>
        <request>Test task</request>
        <investigated></investigated>
        <learned></learned>
        <completed>Done</completed>
        <next_steps></next_steps>
        <notes></notes>
      </summary>
    `;

    const summary = parseSummary(xml);

    expect(summary).not.toBeNull();
    expect(summary!.request).toBe("Test task");
    expect(summary!.investigated).toBeNull();
    expect(summary!.learned).toBeNull();
    expect(summary!.completed).toBe("Done");
    expect(summary!.next_steps).toBeNull();
    expect(summary!.notes).toBeNull();
  });

  test("handles malformed summary without throwing", () => {
    const badXml = "<summary><request>incomplete";
    const result = parseSummary(badXml);
    expect(result).toBeNull();
  });

  test("handles skip_summary directive", () => {
    const xml = '<skip_summary reason="no significant work done" />';
    const result = parseSummary(xml);
    expect(result).toBeNull();
  });

  test("trims whitespace from summary fields", () => {
    const xml = `
      <summary>
        <request>
          Spaced request
        </request>
        <investigated>  spaced investigated  </investigated>
        <learned>  spaced learned  </learned>
        <completed>  spaced completed  </completed>
        <next_steps>  spaced next  </next_steps>
        <notes>  spaced notes  </notes>
      </summary>
    `;

    const summary = parseSummary(xml);

    expect(summary).not.toBeNull();
    expect(summary!.request).toBe("Spaced request");
    expect(summary!.investigated).toBe("spaced investigated");
  });

  test("summary surrounded by other text", () => {
    const xml = `
      Here is some analysis text.
      <summary>
        <request>Mixed content test</request>
        <investigated>Checked things</investigated>
        <learned>Learned things</learned>
        <completed>Completed things</completed>
        <next_steps>Next things</next_steps>
        <notes>Notes</notes>
      </summary>
      More text after.
    `;

    const summary = parseSummary(xml);

    expect(summary).not.toBeNull();
    expect(summary!.request).toBe("Mixed content test");
  });

  test("always saves summary even with missing fields", () => {
    const xml = `
      <summary>
        <request>Partial summary</request>
      </summary>
    `;

    const summary = parseSummary(xml);

    expect(summary).not.toBeNull();
    expect(summary!.request).toBe("Partial summary");
    expect(summary!.investigated).toBeNull();
    expect(summary!.learned).toBeNull();
    expect(summary!.completed).toBeNull();
    expect(summary!.next_steps).toBeNull();
    expect(summary!.notes).toBeNull();
  });
});
