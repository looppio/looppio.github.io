// Gallery owns the image element; the scene requests it only when needed and
// reuses the same decoded pixels for WebGL instead of a second TextureLoader.
export async function loadDecodedCover(image, source) {
  if (!image) throw new Error('The cover image element is missing.');
  if (image.getAttribute('src') !== source) image.src = source;
  if (typeof image.decode === 'function') await image.decode();
  else if (!image.complete)
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener('load', loaded);
        image.removeEventListener('error', failed);
      };
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error('The cover image could not load.'));
      };
      image.addEventListener('load', loaded);
      image.addEventListener('error', failed);
    });
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error('The cover image has no decoded dimensions.');
  return image;
}
