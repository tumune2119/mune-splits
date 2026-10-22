// Builds the on-device version of MUNE Splits as static files in out/ — used by the Android/iOS app
// (Capacitor) and the installable web app on GitHub Pages. Data lives on the device (sql.js + IndexedDB).
//
//   node scripts/build-local.mjs                    → out/ for the Android/iOS app
//   node scripts/build-local.mjs --base /mune-splits → out/ for GitHub Pages (served from a sub-path)
//
// A static export can't contain server code, so the desktop-only server files are moved aside for the
// build and always put back afterwards (also on the next run, if a previous build was interrupted).
// Next also writes intermediate files to .next, which is the desktop build the launcher runs, so
// that folder is set aside too and restored untouched.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stash = path.join(root, ".local-build-stash");
const serverOnly = ["src/app/api", "src/proxy.ts", "src/instrumentation.ts", ".next"];

// Windows + OneDrive can leave entries Node can't delete; cmd's rmdir copes with them.
function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    if (process.platform === "win32") execSync(`cmd /c rmdir /s /q "${dir}"`, { stdio: "ignore" });
  }
}
const baseIdx = process.argv.indexOf("--base");
// One path segment, e.g. /mune-splits. (Git Bash rewrites "/mune-splits" into a Windows path, so only the
// last segment of whatever arrives is used.)
const baseName = baseIdx > 0 ? process.argv[baseIdx + 1].split(/[\\/]/).filter(Boolean).pop() : "";
const basePath = baseName ? `/${baseName}` : "";

function restore() {
  if (!fs.existsSync(stash)) return;
  for (const rel of serverOnly) {
    const from = path.join(stash, rel);
    if (fs.existsSync(from)) {
      removeDir(path.join(root, rel)); // e.g. the .next this build created
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.renameSync(from, path.join(root, rel));
    }
  }
  fs.rmSync(stash, { recursive: true, force: true });
}

restore(); // a previous run may have been interrupted
// sql.js's WebAssembly binary must match its JS exactly, so copy it fresh from node_modules.
fs.copyFileSync(path.join(root, "node_modules/sql.js/dist/sql-wasm-browser.wasm"), path.join(root, "public/sql-wasm.wasm"));

const hadDesktopBuild = fs.existsSync(path.join(root, ".next"));
try {
  for (const rel of serverOnly) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    fs.mkdirSync(path.dirname(path.join(stash, rel)), { recursive: true });
    fs.renameSync(from, path.join(stash, rel));
  }
  removeDir(path.join(root, "out"));
  execSync("npx next build", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_MUNE_TARGET: "local", NEXT_PUBLIC_BASE_PATH: basePath },
  });
} finally {
  restore();
  // No desktop build existed before: don't leave this build's intermediates where the launcher looks.
  if (!hadDesktopBuild) removeDir(path.join(root, ".next"));
}

// Offline support for the web app: the service worker caches every file listed here on install.
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(path.join(root, "out"), p).split(path.sep).join("/"));
  }
};
walk(path.join(root, "out"));
const urls = files
  .filter((f) => !/^(precache\.json|sw-offline\.js|sw\.js|\.nojekyll)$/.test(f) && !f.endsWith(".ico"))
  .map((f) => `${basePath}/${f.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "")}`);
const version = `${JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version}-${Date.now().toString(36)}`;
fs.writeFileSync(path.join(root, "out/precache.json"), JSON.stringify({ version, urls }));
fs.writeFileSync(path.join(root, "out/.nojekyll"), ""); // GitHub Pages: serve the _next folder as-is
console.log(`\n✓ out/ ready (${files.length} files, base path "${basePath || "/"}")\n`);
