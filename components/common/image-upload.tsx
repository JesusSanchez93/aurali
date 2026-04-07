'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Trash2 } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { useTranslations } from 'next-intl';

async function getCroppedImage(
  imageSrc: string,
  croppedAreaPixels: Area,
): Promise<File> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(new File([blob!], 'image.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.85,
    );
  });
}

export interface ImageUploadValue {
  file: File | null;
  previewUrl?: string;
}

interface Props {
  required?: boolean;
  value?: ImageUploadValue;
  onChange: (value?: ImageUploadValue) => void;
  onDeleteClick?: () => void;
}

export function ImageUpload({ required = false, value, onChange, onDeleteClick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onCropConfirm = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    const croppedFile = await getCroppedImage(imageSrc, croppedAreaPixels);

    onChange({
      file: croppedFile,
      previewUrl: URL.createObjectURL(croppedFile),
    });

    setImageSrc(null);
  }, [imageSrc, croppedAreaPixels, onChange]);

  const handleDelete = () => {
    if (onDeleteClick) {
      onDeleteClick();
    } else {
      onChange({ file: null });
    }
  };

  const t = useTranslations('common.upload');

  return (
    <div className="space-y-2">
      {!value?.previewUrl && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFileChange}
            className="hidden"
            required={required}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-500 transition hover:border-gray-400 hover:text-gray-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-300"
            style={{ aspectRatio: 1.55 / 1 }}
          >
            <span className="text-sm">{t('click_to_upload_image')}</span>
            <span className="text-xs text-gray-400 dark:text-slate-500">PNG, JPG, JPEG</span>
          </button>
        </div>
      )}
      {value?.previewUrl && (
        <div className="space-y-2 text-center">
          <img
            src={value.previewUrl}
            alt="Preview"
            className="w-full rounded-md border object-cover"
            style={{ aspectRatio: 1.55 / 1 }}
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleDelete}
          >
            <Trash2 />
          </Button>
        </div>
      )}
      {imageSrc && (
        <div
          style={{ margin: 0 }}
          className="fixed left-0 top-0 z-20 h-full w-full bg-white dark:bg-slate-950"
        >
          <div className="relative mx-auto h-full max-w-screen-sm">
            <Cropper
              classes={{ containerClassName: 'mx-auto max-w-screen-sm' }}
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1.55 / 1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            <div className="absolute bottom-4 left-4 right-4 space-y-2 rounded-md bg-background/80 p-3">
              <Slider
                min={1}
                max={3}
                step={0.1}
                value={[zoom]}
                onValueChange={([z]) => setZoom(z)}
              />
              <Button className="w-full" type="button" onClick={onCropConfirm}>
                {t('confirm_crop')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
