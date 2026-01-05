#!/usr/bin/env node

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const readline = require("readline");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { spawnSync } = require("child_process");

const COLORS = {
  RED: "\u001b[0;31m",
  GREEN: "\u001b[0;32m",
  YELLOW: "\u001b[1;33m",
  BLUE: "\u001b[0;34m",
  NC: "\u001b[0m",
};

const DIVIDER = `${COLORS.GREEN}=======================================================${COLORS.NC}`;

function usage() {
  console.log(`${COLORS.RED}Error: Repository required${COLORS.NC}`);
  console.log("");
  console.log("Usage: ./scripts/get-extension-hash.sh <owner/repo> [version]");
  console.log("");
  console.log("Examples:");
  console.log("  ./scripts/get-extension-hash.sh einord/stina-ext-ollama");
  console.log("  ./scripts/get-extension-hash.sh einord/stina-ext-ollama v1.0.1");
}

async function ask(question) {
  if (!process.stdin.isTTY) {
    return "";
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function askYesNo(question) {
  const answer = await ask(question);
  return /^[yY](?:es)?$/.test(answer);
}

async function askCategories(validCategories) {
  const raw = await ask(
    "Extension not found. Enter categories (comma-separated) [utility]: "
  );
  if (!raw) {
    return ["utility"];
  }
  const categories = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const invalid = categories.filter((item) => !validCategories.includes(item));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid categories: ${invalid.join(", ")}. Allowed: ${validCategories.join(
        ", "
      )}`
    );
  }
  return categories;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "stina-extensions-registry" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data && data.message ? data.message : response.statusText;
    throw new Error(message || "Request failed");
  }
  return data;
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: { "User-Agent": "stina-extensions-registry" },
  });
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error("Download stream not available");
  }
  const stream = Readable.fromWeb(response.body);
  await pipeline(stream, fs.createWriteStream(destination));
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

function readManifestFromZip(zipPath) {
  const result = spawnSync("unzip", ["-p", zipPath, "manifest.json"], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    return null;
  }
  const output = (result.stdout || "").trim();
  if (!output) {
    return null;
  }
  try {
    return JSON.parse(output);
  } catch (error) {
    return null;
  }
}

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatRegistryTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function updateRegistry({
  registryPath,
  manifestId,
  repoUrl,
  version,
  sha256,
  verifiedAt,
}) {
  const contents = await fsp.readFile(registryPath, "utf8");
  const data = JSON.parse(contents);

  if (!Array.isArray(data.extensions)) {
    throw new Error("registry.json missing extensions array");
  }

  let entry = null;
  if (manifestId) {
    entry = data.extensions.find((item) => item.id === manifestId) || null;
  }
  if (!entry) {
    entry = data.extensions.find((item) => item.repository === repoUrl) || null;
  }

  if (!entry) {
    if (!manifestId) {
      throw new Error("Missing extension id for new registry entry");
    }
    const validCategories = ["ai-provider", "tool", "theme", "utility"];
    const categories = await askCategories(validCategories);
    entry = {
      id: manifestId,
      repository: repoUrl,
      categories,
      verified: false,
      blocked: false,
      featured: false,
      verifiedVersions: [],
    };
    data.extensions.push(entry);
  }

  const versions = Array.isArray(entry.verifiedVersions)
    ? entry.verifiedVersions
    : [];
  const filtered = versions.filter((item) => item.version !== version);
  filtered.unshift({
    version,
    sha256,
    verifiedAt,
  });
  entry.verifiedVersions = filtered;

  data.lastUpdated = formatRegistryTimestamp();

  await fsp.writeFile(registryPath, `${JSON.stringify(data, null, 2)}\n`);
}

async function main() {
  const repo = process.argv[2];
  const requestedVersion = process.argv[3];

  if (!repo) {
    usage();
    process.exit(1);
  }

  console.log(`${COLORS.BLUE}Repository:${COLORS.NC} ${repo}`);

  const releaseUrl = requestedVersion
    ? `https://api.github.com/repos/${repo}/releases/tag/${requestedVersion}`
    : `https://api.github.com/repos/${repo}/releases/latest`;

  console.log(
    `${COLORS.BLUE}Fetching ${requestedVersion ? requestedVersion : "latest"} release...${COLORS.NC}`
  );

  let releaseData;
  try {
    releaseData = await fetchJson(releaseUrl);
  } catch (error) {
    console.log(`${COLORS.RED}Error: Release not found${COLORS.NC}`);
    process.exit(1);
  }

  if (releaseData.message === "Not Found") {
    console.log(`${COLORS.RED}Error: Release not found${COLORS.NC}`);
    process.exit(1);
  }

  const tagName = releaseData.tag_name;
  console.log(`${COLORS.BLUE}Version:${COLORS.NC} ${tagName}`);

  const assets = Array.isArray(releaseData.assets) ? releaseData.assets : [];
  const zipAssets = assets.filter((asset) =>
    asset.browser_download_url && asset.browser_download_url.endsWith(".zip")
  );

  if (zipAssets.length === 0) {
    console.log(`${COLORS.RED}Error: No .zip assets found in release${COLORS.NC}`);
    process.exit(1);
  }

  if (zipAssets.length > 1) {
    console.log(
      `${COLORS.YELLOW}Warning: Multiple zip files found, using first one:${COLORS.NC}`
    );
    zipAssets
      .slice(0, 5)
      .forEach((asset) => console.log(asset.browser_download_url));
  }

  const downloadUrl = zipAssets[0].browser_download_url;
  const filename = path.basename(new URL(downloadUrl).pathname);

  console.log(`${COLORS.BLUE}Asset:${COLORS.NC} ${filename}`);
  console.log(`${COLORS.BLUE}Downloading...${COLORS.NC}`);

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "stina-ext-"));
  const zipPath = path.join(tempDir, filename);

  try {
    await downloadFile(downloadUrl, zipPath);

    console.log(`${COLORS.BLUE}Calculating SHA256...${COLORS.NC}`);
    const sha256 = await sha256File(zipPath);

    console.log(`${COLORS.BLUE}Extracting manifest...${COLORS.NC}`);
    const manifest = readManifestFromZip(zipPath);
    const manifestId = manifest && manifest.id ? manifest.id : "";
    const manifestVersion = manifest && manifest.version ? manifest.version : "";
    const manifestName = manifest && manifest.name ? manifest.name : "";

    if (manifestId || manifestName || manifestVersion) {
      console.log("");
      console.log(DIVIDER);
      console.log(`${COLORS.GREEN}Extension Info (from manifest.json)${COLORS.NC}`);
      console.log(DIVIDER);
      if (manifestId) {
        console.log(`  ID:      ${manifestId}`);
      }
      if (manifestName) {
        console.log(`  Name:    ${manifestName}`);
      }
      if (manifestVersion) {
        console.log(`  Version: ${manifestVersion}`);
      }
    }

    const registryVersion = manifestVersion || tagName.replace(/^v/, "");
    const verifiedAt = formatDate();

    console.log("");
    console.log(DIVIDER);
    console.log(`${COLORS.GREEN}Hash Information${COLORS.NC}`);
    console.log(DIVIDER);
    console.log(`  Tag:     ${tagName}`);
    console.log(`  SHA256:  ${sha256}`);
    console.log("");

    console.log(DIVIDER);
    console.log(
      `${COLORS.GREEN}Copy this to registry.json verifiedVersions:${COLORS.NC}`
    );
    console.log(DIVIDER);
    console.log("");
    console.log("{");
    console.log(`  \"version\": \"${registryVersion}\",`);
    console.log(`  \"sha256\": \"${sha256}\",`);
    console.log(`  \"verifiedAt\": \"${verifiedAt}\"`);
    console.log("}");
    console.log("");

    const shouldUpdate = await askYesNo(
      "Update registry.json with this verified version? [y/N] "
    );

    if (!shouldUpdate) {
      return;
    }

    let resolvedManifestId = manifestId;
    if (!resolvedManifestId) {
      resolvedManifestId = await ask(
        "Enter extension id for registry.json (leave blank to skip): "
      );
    }

    const registryPath = path.resolve("registry.json");
    const repoUrl = `https://github.com/${repo}`;

    if (!resolvedManifestId) {
      console.log(
        `${COLORS.RED}Skipping registry.json update (missing id).${COLORS.NC}`
      );
      return;
    }

    await updateRegistry({
      registryPath,
      manifestId: resolvedManifestId,
      repoUrl,
      version: registryVersion,
      sha256,
      verifiedAt,
    });

    console.log(`${COLORS.GREEN}Updated registry.json${COLORS.NC}`);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`${COLORS.RED}Error: ${error.message}${COLORS.NC}`);
  process.exit(1);
});
