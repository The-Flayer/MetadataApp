// Browser-only rasterization (canvas). All DOM/canvas code lives inside functions,
// so importing this module in Node (tests) is safe — the functions just throw if called.

const MAX_DIM = 1024;
const QUALITY = 0.85;
const RASTER_EXTS = ['jpg', 'jpeg', 'png'];

function extOf(fileName) {
  const base = String(fileName).replace(/\\/g, '/').split('/').pop();
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

function loadImg(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = URL.createObjectURL(blob);
  });
}

function toCanvas(img) {
  const canvas = document.createElement('canvas');
  const longest = Math.max(img.naturalWidth || img.width || 1, img.naturalHeight || img.height || 1);
  const scale = Math.min(1, MAX_DIM / longest);
  canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width || 1) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height || 1) * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // JPEG has no alpha; avoid black bleed on transparent SVG/PNG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function isBlank(canvas) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 16) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
  }
  return true;
}

// raster (jpg/png): canvas downscale to max dim 1024, toDataURL jpeg 0.85
// svg: draw into <img> then canvas; blank raster -> warning
// eps-pair: rasterize the JPG companion only
export async function rasterizeAsset(asset) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('rasterizeAsset membutuhkan browser (canvas)');
  }
  if (!asset.warnings) asset.warnings = [];

  const target =
    asset.kind === 'eps-pair'
      ? asset.files.find((f) => RASTER_EXTS.includes(extOf(f.name)))
      : asset.files[0];
  if (!target) throw new Error('Tidak ada file untuk dirasterisasi');

  const img = await loadImg(target.blob);
  const nw = img.naturalWidth || img.width || 0;
  const nh = img.naturalHeight || img.height || 0;
  if (nw > 0 && nh > 0) asset.dims = { w: nw, h: nh };
  const canvas = toCanvas(img);
  if (asset.kind === 'svg' && isBlank(canvas)) {
    asset.warnings.push('Pratinjau kosong: SVG mungkin memiliki referensi eksternal');
  }
  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  asset.rasterB64 = dataUrl;
  asset.previewUrl = dataUrl;
}
