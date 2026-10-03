/** Read an uploaded file, shrinking big photos so the design stays light to save. */
export function fileToDataUrl(file: File, maxSide = 1600): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        if (s === 1 && file.size < 900_000) {
          resolve({ src: reader.result as string, w: img.naturalWidth, h: img.naturalHeight });
          return;
        }
        const w = Math.round(img.naturalWidth * s);
        const h = Math.round(img.naturalHeight * s);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const png = file.type === "image/png";
        resolve({ src: canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.88), w, h });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

/** Natural width / height of a photo or video element's source. */
export function mediaRatio(src: string, video: boolean): Promise<number> {
  if (!video) return imageSize(src).then(({ w, h }) => w / h);
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.videoWidth / v.videoHeight);
    v.onerror = reject;
    v.src = src;
  });
}
