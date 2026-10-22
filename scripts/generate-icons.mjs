// Renders the MUNE Splits logo to the PWA icons and the Windows shortcut .ico.
// Run with `npm run icons` (uses sharp, which ships with Next.js). Output is committed in public/icons.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const out = path.resolve("public/icons");
fs.mkdirSync(out, { recursive: true });

// pad: empty space around the tile (viewBox units); bg: fill that space with the app background.
const logo = (pad = 0, bg = true) => {
  const s = 64 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${s} ${s}" width="512" height="512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFC29F"/>
      <stop offset="1" stop-color="#FF9455"/>
    </linearGradient>
  </defs>
  ${pad && bg ? `<rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" fill="#0e0e10"/>` : ""}
  <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#g)"/>
  <path d="M13 47V22l14 15 14-15v25" stroke="#1C1009" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50.5" cy="17" r="5" fill="none" stroke="#1C1009" stroke-width="2.2"/>
  <path d="M50.5 12a5 5 0 0 1 0 10z" fill="#1C1009"/>
</svg>`;
};

fs.writeFileSync(path.join(out, "icon.svg"), logo());

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

for (const size of [192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${size}.png`), await png(logo(), size));
}
// Maskable icons need the artwork inside the central 80% safe zone.
fs.writeFileSync(path.join(out, "maskable-512.png"), await png(logo(10), 512));
// iPhone home-screen icon: opaque, iOS rounds the corners itself.
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), await png(logo(6), 180));

// Sources for the Android/iOS app icons and splash screens (npx @capacitor/assets generate).
const assets = path.resolve("assets");
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, "icon-only.png"), await png(logo(6), 1024));
// Adaptive icon: the mark sits inside the central safe zone on a dark background layer.
fs.writeFileSync(path.join(assets, "icon-foreground.png"), await png(logo(30, false), 1024));
fs.writeFileSync(path.join(assets, "icon-background.png"), await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#0e0e10" } }).png().toBuffer());
const splash = await sharp({ create: { width: 2732, height: 2732, channels: 4, background: "#0e0e10" } })
  .composite([{ input: await png(logo(), 560), gravity: "center" }])
  .png()
  .toBuffer();
fs.writeFileSync(path.join(assets, "splash.png"), splash);
fs.writeFileSync(path.join(assets, "splash-dark.png"), splash);

// .ico with embedded PNGs (supported since Windows Vista).
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map((s) => png(logo(), s)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
const dir = Buffer.alloc(16 * images.length);
let offset = 6 + dir.length;
images.forEach((img, i) => {
  const s = sizes[i];
  const e = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, e);
  dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
  dir.writeUInt8(0, e + 2);
  dir.writeUInt8(0, e + 3);
  dir.writeUInt16LE(1, e + 4);
  dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(img.length, e + 8);
  dir.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
fs.writeFileSync(path.join(out, "mune-splits.ico"), Buffer.concat([header, dir, ...images]));

console.log("Icons written to", out);
