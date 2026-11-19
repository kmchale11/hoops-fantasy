// Renders the app icons from the basketball drawn below: the website's in public/icons, and the
// phone apps' source images in mobile/assets (turned into every size by `npm run assets` there).
// Run after changing the design: node scripts/make-icons.mjs
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const GREEN = "#0b6e4f";
const ORANGE = "#f28c28";
const SEAM = "#3b1d06";

/**
 * A basketball on the brand green. `ball` is the ball's diameter as a share of the icon;
 * `transparent` leaves out the green, for Android's adaptive icon foreground.
 */
function svg({ size, ball, rounded, transparent = false }) {
  const r = (size * ball) / 2;
  const c = size / 2;
  const w = Math.max(2, size * 0.022);
  const corner = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${transparent ? "" : `<rect width="${size}" height="${size}" rx="${corner}" fill="${GREEN}"/>`}
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

const mobile = new URL("../mobile/assets/", import.meta.url);
mkdirSync(mobile, { recursive: true });
const appImages = [
  // Square and opaque: the phones apply their own icon shape.
  { file: "icon-only.png", size: 1024, ball: 0.7, rounded: false },
  // Android adaptive icon: the ball over a plain green layer. The assets tool insets the
  // foreground by a sixth on each side, which brings the ball inside the 66% safe circle.
  { file: "icon-foreground.png", size: 1024, ball: 0.76, rounded: false, transparent: true },
  { file: "icon-background.png", size: 1024, ball: 0, rounded: false },
  // Splash screens: a small ball centred on green, the same in dark mode.
  { file: "splash.png", size: 2732, ball: 0.16, rounded: false },
  { file: "splash-dark.png", size: 2732, ball: 0.16, rounded: false },
];
for (const image of appImages) {
  const drawing = image.ball ? svg(image) : svg({ ...image, ball: 0.0001 }).replace(/<circle[^>]*>|<g[\s\S]*<\/g>/g, "");
  await sharp(Buffer.from(drawing)).png().toFile(new URL(image.file, mobile).pathname);
  console.log(`mobile/assets/${image.file}`);
}
