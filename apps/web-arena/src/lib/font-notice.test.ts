import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FONTS = join(__dirname, "..", "..", "public", "fonts");

describe("font supplements", () => {
  it("ship an SIL OFL 1.1 notice beside them", () => {
    const notice = readFileSync(join(FONTS, "OFL-NOTICE.txt"), "utf8");
    expect(notice).toContain("Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo)");
    expect(notice).toContain("Copyright 2020 The Martian Mono Project Authors (https://github.com/evilmartians/mono)");
    expect(notice).toContain("SIL Open Font License, Version 1.1");
    expect(notice).toContain("https://openfontlicense.org");
    // Every supplement is named in the notice.
    for (const f of readdirSync(FONTS).filter((n) => n.endsWith(".woff2"))) expect(notice).toContain(f);
  });

  it("are named in the README's licence section", () => {
    const readme = readFileSync(join(__dirname, "..", "..", "..", "..", "README.md"), "utf8");
    const licence = readme.slice(readme.indexOf("License\n"));
    expect(licence).toContain("apps/web-arena/public/fonts/OFL-NOTICE.txt");
  });
});
