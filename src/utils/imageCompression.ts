export type CompressedImageResult = {
  file: File;
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  contentType: 'image/jpeg' | 'image/webp';
  extension: 'jpg' | 'webp';
};

export async function compressImageForUpload(
  file: File,
  options?: {
    maxLongEdge?: number;
    targetBytes?: number;
    maxBytes?: number;
    preferredType?: 'image/jpeg' | 'image/webp';
    minQuality?: number;
    initialQuality?: number;
  }
): Promise<CompressedImageResult> {
  const maxLongEdge = options?.maxLongEdge ?? 1600;
  const targetBytes = options?.targetBytes ?? 900 * 1024; // 900KB
  const maxBytes = options?.maxBytes ?? 950 * 1024; // 950KB
  const preferredType = options?.preferredType ?? 'image/jpeg';
  const minQuality = options?.minQuality ?? 0.62;
  const initialQuality = options?.initialQuality ?? 0.82;

  const originalSize = file.size;

  // 원본이 이미 950KB 이하이고 형식이 preferredType인 경우, 원본을 그냥 유지
  const isAllowedOriginalType = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (originalSize <= maxBytes && isAllowedOriginalType && file.type === preferredType) {
    try {
      const dimensions = await getImageDimensions(file);
      const ext = preferredType === 'image/webp' ? 'webp' : 'jpg';
      return {
        file,
        blob: file,
        width: dimensions.width,
        height: dimensions.height,
        originalSize,
        compressedSize: originalSize,
        contentType: preferredType,
        extension: ext,
      };
    } catch (e) {
      console.warn('Failed to get dimensions of original image, proceeding to standard compression path', e);
    }
  }

  // 1. 이미지를 로드한다.
  const img = await loadImage(file);

  // 2. 해상도 및 품질 단계 설정
  // 리사이즈 단계: maxLongEdge, maxLongEdge * 0.9, maxLongEdge * 0.8
  const scaleSteps = [1.0, 0.9, 0.8];
  
  // 품질 단계: 0.82 -> 0.76 -> 0.70 -> 0.66 -> 0.62
  const qualitySteps = [0.82, 0.76, 0.70, 0.66, 0.62];

  let bestResult: {
    blob: Blob;
    width: number;
    height: number;
    size: number;
    quality: number;
    scale: number;
  } | null = null;

  // 3. 루프 실행
  for (const scale of scaleSteps) {
    const targetLongEdge = Math.round(maxLongEdge * scale);
    const origLongEdge = Math.max(img.width, img.height);
    const currentLongEdge = Math.min(origLongEdge, targetLongEdge);
    
    let w = img.width;
    let h = img.height;
    if (origLongEdge > currentLongEdge) {
      if (img.width > img.height) {
        w = currentLongEdge;
        h = Math.round((img.height * currentLongEdge) / img.width);
      } else {
        h = currentLongEdge;
        w = Math.round((img.width * currentLongEdge) / img.height);
      }
    }

    // canvas 생성 및 그리기
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    
    // 배경을 흰색으로 채움 (JPEG 투명도 방지)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const quality of qualitySteps) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), preferredType, quality);
      });

      if (!blob) continue;

      const result = {
        blob,
        width: w,
        height: h,
        size: blob.size,
        quality,
        scale,
      };

      if (!bestResult || result.size < bestResult.size) {
        bestResult = result;
      }

      // targetBytes (900KB) 이하를 달성하면 즉시 성공 리턴
      if (result.size <= targetBytes) {
        const ext = preferredType === 'image/webp' ? 'webp' : 'jpg';
        const compressedFile = new File([result.blob], file.name, {
          type: preferredType,
          lastModified: Date.now(),
        });
        return {
          file: compressedFile,
          blob: result.blob,
          width: result.width,
          height: result.height,
          originalSize,
          compressedSize: result.size,
          contentType: preferredType,
          extension: ext,
        };
      }
    }
  }

  // 950KB 이하를 만족하는 bestResult가 있다면 리턴
  if (bestResult && bestResult.size <= maxBytes) {
    const ext = preferredType === 'image/webp' ? 'webp' : 'jpg';
    const compressedFile = new File([bestResult.blob], file.name, {
      type: preferredType,
      lastModified: Date.now(),
    });
    return {
      file: compressedFile,
      blob: bestResult.blob,
      width: bestResult.width,
      height: bestResult.height,
      originalSize,
      compressedSize: bestResult.size,
      contentType: preferredType,
      extension: ext,
    };
  }

  // 950KB 이하가 결국 되지 않은 경우, 가장 최소 크기를 리턴
  if (bestResult) {
    const ext = preferredType === 'image/webp' ? 'webp' : 'jpg';
    const compressedFile = new File([bestResult.blob], file.name, {
      type: preferredType,
      lastModified: Date.now(),
    });
    return {
      file: compressedFile,
      blob: bestResult.blob,
      width: bestResult.width,
      height: bestResult.height,
      originalSize,
      compressedSize: bestResult.size,
      contentType: preferredType,
      extension: ext,
    };
  }

  throw new Error('Image compression failed to produce any output');
}

export async function compressImageFile(file: File): Promise<{
  blob: Blob;
  width: number;
  height: number;
  contentType: string;
  size: number;
}> {
  const result = await compressImageForUpload(file, {
    maxLongEdge: 1280,
    initialQuality: 0.8,
    minQuality: 0.8,
  });
  return {
    blob: result.blob,
    width: result.width,
    height: result.height,
    contentType: result.contentType,
    size: result.compressedSize
  };
}

// 헬퍼 함수들
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
