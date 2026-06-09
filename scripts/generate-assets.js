/**
 * Generates all ChrisChat branded assets: icon, favicon, splash-icon,
 * and Android adaptive icon layers.
 *
 * Run:  node scripts/generate-assets.js
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// ─── Drawing helpers ───────────────────────────────────────────────

function drawHeart(ctx, x, y, size) {
  ctx.beginPath();
  const topY = y - size * 0.4;
  ctx.moveTo(x, y + size * 0.3);
  ctx.bezierCurveTo(x - size * 0.5, y - size * 0.1, x - size * 0.5, topY, x - size * 0.25, topY);
  ctx.bezierCurveTo(x - size * 0.05, topY, x, y - size * 0.1, x, y - size * 0.1);
  ctx.bezierCurveTo(x, y - size * 0.1, x + size * 0.05, topY, x + size * 0.25, topY);
  ctx.bezierCurveTo(x + size * 0.5, topY, x + size * 0.5, y - size * 0.1, x, y + size * 0.3);
  ctx.closePath();
}

function drawCross(ctx, x, y, size) {
  const w = size * 0.12;
  const h = size * 0.35;
  // vertical bar
  roundRect(ctx, x - w / 2, y - h / 2, w, h, w * 0.2);
  ctx.fill();
  // horizontal bar
  roundRect(ctx, x - h * 0.35, y - h * 0.18, h * 0.7, w, w * 0.2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawChatBubble(ctx, x, y, size) {
  const w = size * 0.6;
  const h = size * 0.45;
  const r = size * 0.1;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
  ctx.fill();
  // tail
  ctx.beginPath();
  ctx.moveTo(x - w * 0.15, y + h / 2 - 1);
  ctx.lineTo(x - w * 0.3, y + h / 2 + size * 0.08);
  ctx.lineTo(x + w * 0.05, y + h / 2 - 1);
  ctx.closePath();
  ctx.fill();
}

function drawLogo(ctx, cx, cy, size, withBg) {
  if (withBg) {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#6C3CE1');   // primary purple
    grad.addColorStop(0.5, '#8B5CF6'); // primaryLight
    grad.addColorStop(1, '#F43F5E');   // secondary rose
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, size, size, size * 0.22);
    ctx.fill();
  }

  // Heart
  const heartSize = size * 0.45;
  drawHeart(ctx, cx, cy + size * 0.02, heartSize);
  const heartGrad = ctx.createLinearGradient(cx, cy - heartSize * 0.4, cx, cy + heartSize * 0.3);
  heartGrad.addColorStop(0, withBg ? '#FFFFFF' : '#6C3CE1');
  heartGrad.addColorStop(1, withBg ? '#E8D5FF' : '#F43F5E');
  ctx.fillStyle = heartGrad;
  ctx.fill();

  // Chat bubble inside heart
  ctx.fillStyle = withBg ? '#6C3CE1' : '#FFFFFF';
  drawChatBubble(ctx, cx, cy - size * 0.02, size * 0.28);

  // Cross inside bubble
  ctx.fillStyle = withBg ? '#FFFFFF' : '#6C3CE1';
  drawCross(ctx, cx, cy - size * 0.04, size * 0.28);
}

function drawForeground(ctx, size) {
  const inset = size * 0.17;
  const iconSize = size - inset * 2;
  ctx.save();
  ctx.translate(inset, inset);
  const cx = iconSize / 2;
  const cy = iconSize / 2;

  const heartSize = iconSize * 0.45;
  drawHeart(ctx, cx, cy + iconSize * 0.02, heartSize);
  const heartGrad = ctx.createLinearGradient(cx, cy - heartSize * 0.4, cx, cy + heartSize * 0.3);
  heartGrad.addColorStop(0, '#6C3CE1');
  heartGrad.addColorStop(1, '#F43F5E');
  ctx.fillStyle = heartGrad;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  drawChatBubble(ctx, cx, cy - iconSize * 0.02, iconSize * 0.28);

  ctx.fillStyle = '#6C3CE1';
  drawCross(ctx, cx, cy - iconSize * 0.04, iconSize * 0.28);

  ctx.restore();
}

// ─── Asset generation ──────────────────────────────────────────────

function save(canvas, filename) {
  const buf = canvas.toBuffer('image/png');
  const dest = path.join(ASSETS_DIR, filename);
  fs.writeFileSync(dest, buf);
  console.log(`  ✓ ${filename} (${canvas.width}x${canvas.height})`);
}

console.log('Generating ChrisChat assets...\n');

// 1. icon.png (1024x1024) — App icon with background
const icon = createCanvas(1024, 1024);
drawLogo(icon.getContext('2d'), 512, 512, 1024, true);
save(icon, 'icon.png');

// 2. favicon.png (48x48) — Web favicon
const fav = createCanvas(48, 48);
drawLogo(fav.getContext('2d'), 24, 24, 48, true);
save(fav, 'favicon.png');

// 3. splash-icon.png (200x200) — Splash screen icon (no bg, transparent)
const splash = createCanvas(200, 200);
drawLogo(splash.getContext('2d'), 100, 100, 200, false);
save(splash, 'splash-icon.png');

// 4. android-icon-foreground.png (1024x1024) — Adaptive foreground
const fg = createCanvas(1024, 1024);
drawForeground(fg.getContext('2d'), 1024);
save(fg, 'android-icon-foreground.png');

// 5. android-icon-background.png (1024x1024) — Adaptive background
const bg = createCanvas(1024, 1024);
const bgCtx = bg.getContext('2d');
const bgGrad = bgCtx.createLinearGradient(0, 0, 1024, 1024);
bgGrad.addColorStop(0, '#F3EEFF');  // light purple
bgGrad.addColorStop(1, '#FFF0F3');  // light rose
bgCtx.fillStyle = bgGrad;
bgCtx.fillRect(0, 0, 1024, 1024);
save(bg, 'android-icon-background.png');

// 6. android-icon-monochrome.png (1024x1024) — Monochrome (black)
const mono = createCanvas(1024, 1024);
const monoCtx = mono.getContext('2d');
const inset = 1024 * 0.17;
const iconSize = 1024 - inset * 2;
monoCtx.save();
monoCtx.translate(inset, inset);
const mcx = iconSize / 2;
const mcy = iconSize / 2;
drawHeart(monoCtx, mcx, mcy + iconSize * 0.02, iconSize * 0.45);
monoCtx.fillStyle = '#000000';
monoCtx.fill();
monoCtx.fillStyle = '#FFFFFF';
drawChatBubble(monoCtx, mcx, mcy - iconSize * 0.02, iconSize * 0.28);
monoCtx.fillStyle = '#000000';
drawCross(monoCtx, mcx, mcy - iconSize * 0.04, iconSize * 0.28);
monoCtx.restore();
save(mono, 'android-icon-monochrome.png');

console.log('\nDone! All assets saved to assets/');
