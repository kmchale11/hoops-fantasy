// Renders the app icons in public/icons from the basketball drawn below.
// Run after changing the design: node scripts/make-icons.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const GREEN = "#0b6e4f";
const ORANGE = "#f28c28";
const SEAM = "#3b1d06";

/** A basketball on the brand green. `ball` is the ball's diameter as a share of the icon. */
function svg({ size, ball, rounded }) {
  const r = (size * ball) / 2;
  const c = size / 2;
  const w = Math.max(2, size * 0.022);
  const corner = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${corner}" fill="${GREEN}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="${ORANGE}" stroke="${SEAM}" stroke-width="${w}"/>
  <g fill="none" stroke="${SEAM}" stroke-width="${w}" stroke-linecap="round">
    <line x1="${c - r}" y1="${c}" x2="${c + r}" y2="${c}"/>
    <line x1="${c}" y1="${c - r}" x2="${c}" y2="${c + r}"/>
    <path d="M ${c - r * 0.62} ${c - r * 0.78} Q ${c - r * 0.18} ${c} ${c - r * 0.62} ${c + r * 0.78}"/>
    <path d="M ${c + r * 0.62} ${c - r * 0.78} Q ${c + r * 0.18} ${c} ${c + r * 0.62} ${c + r * 0.78}"/>
  </g>
</svg>`;
}

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });
const icons = [
  // "any" icons: rounded tile, ball filling most of it.
  { file: "icon-192.png", size: 192, ball: 0.74, rounded: true },
  { file: "icon-512.png", size: 512, ball: 0.74, rounded: true },
  // Maskable: full-bleed background, ball inside the central 80% safe zone.
  { file: "maskable-512.png", size: 512, ball: 0.6, rounded: false },
  // iOS rounds the corners itself and shows transparency as black, so square and opaque.
  { file: "apple-touch-icon.png", size: 180, ball: 0.7, rounded: false },
];
for (const icon of icons) {
  await sharp(Buffer.from(svg(icon))).png().toFile(new URL(icon.file, out).pathname);
  console.log(`public/icons/${icon.file}`);
}
