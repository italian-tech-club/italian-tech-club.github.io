import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

const CROP_SIZE = 400; // Final output size in pixels
const ASPECT_RATIO = 1; // Square
const MIN_CROP_PERCENT = 30; // Minimum crop size as percentage

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 80,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

function ensureMinCrop(crop, minPercent) {
  if (!crop) return null;
  return {
    ...crop,
    width: Math.max(crop.width, minPercent),
    height: Math.max(crop.height, minPercent),
  };
}

const ImageCropper = ({ imageFile, onCropComplete, onCancel }) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);
  const imgRef = useRef(null);
  const [imgSrc, setImgSrc] = useState('');

  // Load image when file changes
  React.useEffect(() => {
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = () => setImgSrc(reader.result?.toString() || '');
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile]);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, ASPECT_RATIO));
  }, []);

  const getCroppedImg = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas to exact output size
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;

    // Calculate source coordinates
    const sourceX = completedCrop.x * scaleX;
    const sourceY = completedCrop.y * scaleY;
    const sourceWidth = completedCrop.width * scaleX;
    const sourceHeight = completedCrop.height * scaleY;

    // Draw cropped image to canvas at exact size
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    // Convert to base64
    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(base64);
  }, [completedCrop, onCropComplete]);

  const resetCrop = () => {
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, ASPECT_RATIO));
    }
    setScale(1);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Crop Your Photo</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Cropper */}
        <div className="p-4 bg-slate-900 flex items-center justify-center min-h-[300px]">
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(ensureMinCrop(percentCrop, MIN_CROP_PERCENT))}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={ASPECT_RATIO}
              minWidth={50}
              minHeight={50}
              keepSelection={true}
              className="max-h-[400px]"
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ transform: `scale(${scale})` }}
                className="max-h-[400px] transition-transform"
              />
            </ReactCrop>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5 text-slate-600" />
              </button>
              <span className="text-sm text-slate-500 w-12 text-center">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale(s => Math.min(3, s + 0.1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={resetCrop}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-2"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Output: {CROP_SIZE}×{CROP_SIZE}px
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={getCroppedImg}
              className="flex-1 py-3 rounded-xl bg-itc-green text-white font-medium hover:bg-itc-green/90 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;
