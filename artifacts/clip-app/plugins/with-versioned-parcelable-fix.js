const {
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const RESOLUTION_MARKER =
  "force 'androidx.versionedparcelable:versionedparcelable:1.1.1'";

const RESOLUTION_BLOCK = `
    configurations.all {
        resolutionStrategy {
            force 'androidx.core:core:1.12.0'
            ${RESOLUTION_MARKER}
        }
        exclude group: 'com.android.support'
    }
`;

function injectIntoAndroidBlock(contents) {
  if (contents.includes(RESOLUTION_MARKER)) return contents;

  const startMatch = contents.match(/(?:^|\n)android\s*\{/);
  if (!startMatch) {
    throw new Error(
      "[with-versioned-parcelable-fix] Could not find android { } block in app/build.gradle"
    );
  }
  const startIdx = startMatch.index + startMatch[0].length;

  let depth = 1;
  let i = startIdx;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  while (i < contents.length && depth > 0) {
    const ch = contents[i];
    const next = contents[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
    } else if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
    } else if (inSingleQuote) {
      if (ch === "\\") i += 1;
      else if (ch === "'") inSingleQuote = false;
    } else if (inDoubleQuote) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inDoubleQuote = false;
    } else if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
    } else if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
    } else if (ch === "'") {
      inSingleQuote = true;
    } else if (ch === '"') {
      inDoubleQuote = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return contents.slice(0, i) + RESOLUTION_BLOCK + contents.slice(i);
      }
    }
    i += 1;
  }

  throw new Error(
    "[with-versioned-parcelable-fix] Unbalanced android { } block in app/build.gradle"
  );
}

const REPO_MARKER = "// versioned-parcelable-fix-allprojects-repos";
const ALLPROJECTS_BLOCK = `
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
${REPO_MARKER}
`;

function ensureAllProjectsRepos(contents) {
  if (contents.includes(REPO_MARKER)) return contents;

  const m = contents.match(
    /allprojects\s*\{[\s\S]*?repositories\s*\{([\s\S]*?)\}/
  );
  if (m) {
    const inner = m[1];
    let next = inner;
    if (!/\bmavenCentral\s*\(\s*\)/.test(inner)) {
      next = "\n        mavenCentral()" + next;
    }
    if (!/\bgoogle\s*\(\s*\)/.test(inner)) {
      next = "\n        google()" + next;
    }
    if (next === inner) return contents;
    return (
      contents.slice(0, m.index) +
      m[0].replace(inner, next) +
      contents.slice(m.index + m[0].length)
    );
  }

  return contents.trimEnd() + "\n\n" + ALLPROJECTS_BLOCK;
}

const withVersionedParcelableFix = (config) => {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        `[with-versioned-parcelable-fix] Expected groovy app/build.gradle, got ${cfg.modResults.language}`
      );
    }
    cfg.modResults.contents = injectIntoAndroidBlock(cfg.modResults.contents);
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        `[with-versioned-parcelable-fix] Expected groovy project build.gradle, got ${cfg.modResults.language}`
      );
    }
    cfg.modResults.contents = ensureAllProjectsRepos(cfg.modResults.contents);
    return cfg;
  });

  return config;
};

module.exports = withVersionedParcelableFix;
