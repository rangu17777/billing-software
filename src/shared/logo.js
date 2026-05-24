import logoUrl from '../assets/aan-logo.jpeg';
import brandLogoUrl from '../assets/brand-logo.jpeg';

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

// Auto-trim the white margins around a logo and return a tight dataURL.
// Used for the app top-bar brand mark (keeps white bg so it reads on any theme).
let brandCache = null;
export async function getBrandLogo() {
  if (brandCache) return brandCache;
  const img = await loadImage(brandLogoUrl);
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = 0, maxY = 0, found = false;
  const step = 2;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (!(d[i] >= 245 && d[i + 1] >= 245 && d[i + 2] >= 245)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) { minX = 0; minY = 0; maxX = W - 1; maxY = H - 1; }
  const pad = Math.round(Math.max(W, H) * 0.015);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
  const sw = maxX - minX + 1, sh = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  const octx = out.getContext('2d');
  octx.fillStyle = '#fff';
  octx.fillRect(0, 0, sw, sh);
  octx.drawImage(img, minX, minY, sw, sh, 0, 0, sw, sh);
  brandCache = { dataUrl: out.toDataURL('image/jpeg', 0.95), aspect: sw / sh };
  return brandCache;
}

// Crop the brand JPEG in-browser to the lockup bounding box — trims the white
// margins and the "LOGO DESIGN MAHARASHTRA" credit baked into the source file.
// Standalone (no jsPDF) so it can be reused on the login page without bloating it.
let cleanLogoCache = null;
export async function getCleanLogo() {
  if (cleanLogoCache) return cleanLogoCache;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = logoUrl;
  });
  const L = 0.14, R = 0.84, T = 0.335, B = 0.695;
  const sx = img.width * L, sy = img.height * T;
  const sw = img.width * (R - L), sh = img.height * (B - T);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  cleanLogoCache = { dataUrl: c.toDataURL('image/jpeg', 0.95), aspect: sw / sh };
  return cleanLogoCache;
}
