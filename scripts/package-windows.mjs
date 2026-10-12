// Builds the self-contained Windows release: release/MUNE-Splits-<version>-windows-x64.zip
// It holds the standalone Next.js server, the Node.js runtime this script runs on (so friends don't need
// Node installed), and the installer/launcher scripts from packaging/windows. Run with `npm run package:win`.
//
// The bundled better-sqlite3 binary must match the bundled Node version, so run this with the same Node
// that installed node_modules (Node 20 x64 for better-sqlite3 12.9.0 prebuilt binaries).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (process.platform !== "win32" || process.arch !== "x64") {
  console.error("Run this on 64-bit Windows: the bundle contains Windows binaries (node.exe, better-sqlite3).");
  process.exit(1);
}

const name = `MUNE-Splits-${pkg.version}-windows-x64`;
const releaseDir = path.join(root, "release");
const out = path.join(releaseDir, name);
const dist = path.join(root, ".next-release");
const copy = (from, to) => fs.cpSync(from, to, { recursive: true, dereference: true });

console.log(`\n▸ Building ${name}\n`);
fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(`${out}.zip`, { force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Standalone production build (separate distDir, see next.config.ts).
execSync("npx next build", { cwd: root, stdio: "inherit", env: { ...process.env, MUNE_SPLITS_RELEASE: "1" } });

// 2. Server + the static files it serves.
console.log("▸ Copying app");
copy(path.join(dist, "standalone"), path.join(out, "app"));
copy(path.join(dist, "static"), path.join(out, "app", ".next-release", "static"));
copy(path.join(root, "public"), path.join(out, "app", "public"));
// Standalone copies don't need a data folder; the installed app keeps data in %APPDATA%.
fs.rmSync(path.join(out, "app", "data"), { recursive: true, force: true });

// 3. Node.js runtime.
console.log(`▸ Bundling Node.js ${process.version}`);
fs.mkdirSync(path.join(out, "node"));
fs.copyFileSync(process.execPath, path.join(out, "node", "node.exe"));
try {
  const res = await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`);
  if (!res.ok) throw new Error(String(res.status));
  fs.writeFileSync(path.join(out, "node", "LICENSE"), await res.text());
} catch (err) {
  fs.writeFileSync(
    path.join(out, "node", "LICENSE"),
    `Node.js ${process.version} is licensed under the MIT license.\nFull text: https://github.com/nodejs/node/blob/${process.version}/LICENSE\n`,
  );
  console.warn(`  (couldn't download the Node.js license text: ${err.message}; wrote a pointer instead)`);
}

// 4. Launcher, installer, docs.
console.log("▸ Adding installer");
for (const f of fs.readdirSync(path.join(root, "packaging", "windows"))) {
  fs.copyFileSync(path.join(root, "packaging", "windows", f), path.join(out, f));
}
fs.copyFileSync(path.join(root, "public", "icons", "mune-splits.ico"), path.join(out, "mune-splits.ico"));
fs.copyFileSync(path.join(root, "LICENSE"), path.join(out, "LICENSE"));
fs.writeFileSync(path.join(out, "version.txt"), `${pkg.version}\r\n`);

// 5. Zip with Windows' own bsdtar (System32): it writes deflated zips. A GNU tar earlier on PATH (Git) can't.
console.log("▸ Zipping");
const tar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
execSync(`"${tar}" -a --options zip:compression=deflate -c -f "${name}.zip" "${name}"`, { cwd: releaseDir, stdio: "inherit" });
const mb = (fs.statSync(`${out}.zip`).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ release/${name}.zip (${mb} MB)\n`);
