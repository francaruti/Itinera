/** Preparación y caché de los archivos adjuntos (capturas de reservas y pases de abordar). */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
const FILES_CACHE = 'files-v1';
export const attachmentUrl = (id: string) => `/api/attachments/${id}`;

export interface PreparedFile {
  blob: Blob;
  name: string;
  mime: string;
}

async function compressImage(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch {
    return null;
  }
}

/** Reduce las imágenes (~300 KB) y valida el tamaño de los PDF. Lanza un Error con mensaje para mostrar. */
export async function prepareFile(file: File): Promise<PreparedFile> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > MAX_FILE_BYTES) throw new Error('El PDF pesa más de 3 MB. Toma una captura de pantalla en su lugar.');
    return { blob: file, name: file.name, mime: 'application/pdf' };
  }
  if (!file.type.startsWith('image/')) throw new Error('Solo se admiten imágenes y PDF.');
  const out = await compressImage(file);
  if (out && out.size <= MAX_FILE_BYTES) return { blob: out, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg' };
  if (file.size <= MAX_FILE_BYTES) return { blob: file, name: file.name, mime: file.type };
  throw new Error('La imagen es demasiado grande.');
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Guarda el archivo en la caché local para verlo al instante y sin conexión. */
export async function cacheAttachment(id: string, blob: Blob) {
  try {
    const c = await caches.open(FILES_CACHE);
    await c.put(attachmentUrl(id), new Response(blob, { headers: { 'Content-Type': blob.type } }));
  } catch {
    /* sin Cache API */
  }
}
export async function uncacheAttachment(id: string) {
  try {
    await (await caches.open(FILES_CACHE)).delete(attachmentUrl(id));
  } catch {
    /* nada */
  }
}

/** Descarga (una vez) los adjuntos que aún no están en el teléfono: así el pase de abordar abre sin internet. */
export async function warmAttachments(ids: string[]) {
  if (typeof caches === 'undefined') return;
  try {
    const c = await caches.open(FILES_CACHE);
    for (const id of ids) {
      if (await c.match(attachmentUrl(id))) continue;
      const res = await fetch(attachmentUrl(id), { credentials: 'same-origin' });
      if (res.ok) await c.put(attachmentUrl(id), res);
    }
  } catch {
    /* sin conexión: se reintenta en la próxima sincronización */
  }
}

export const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
