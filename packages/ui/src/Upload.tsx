/**
 * ShipImageUpload / ShipFileUpload — file-upload widgets that POST a `file`
 * field to an upload endpoint and surface the parsed result through `onUpload`.
 * `value` (an existing asset URL) is shown as the initial preview.
 */

'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

export interface UploadResult {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  sizes?: Record<string, { url: string; width?: number; height?: number }>;
}

export interface UploadProps {
  name: string;
  accept?: string;
  label?: ReactNode;
  /** Existing asset URL to preview before a new upload. */
  value?: string;
  /** Upload endpoint. Defaults to `/upload`. */
  url?: string;
  onUpload?: (result?: UploadResult) => void;
}

/** POSTs `file` to `url` and returns the parsed `data` payload. */
async function postUpload(file: File, url: string): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(url, { method: 'POST', body: formData });
  const body = await res.json();
  return body.data as UploadResult;
}

/** Image upload widget with a local object-URL preview. */
export function ShipImageUpload({
  name,
  accept,
  label,
  value,
  url,
  onUpload,
}: UploadProps) {
  const [preview, setPreview] = useState<string | null>(value ?? null);

  return (
    <div className="space-y-2">
      {label ? <span className="label-text">{label}</span> : null}
      <input
        type="file"
        name={name}
        accept={accept ?? 'image/*'}
        className="file-input file-input-bordered w-full"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const result = await postUpload(file, url ?? '/upload');
            onUpload?.(result);
            setPreview(URL.createObjectURL(file));
          } catch {
            onUpload?.();
          }
        }}
      />
      {preview ? (
        <img src={preview} alt="" className="h-24 w-24 rounded-box object-cover" />
      ) : null}
    </div>
  );
}

/** File upload widget that shows the selected file name. */
export function ShipFileUpload({
  name,
  accept,
  label,
  value,
  url,
  onUpload,
}: UploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {label ? <span className="label-text">{label}</span> : null}
      <input
        type="file"
        name={name}
        accept={accept}
        className="file-input file-input-bordered w-full"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const result = await postUpload(file, url ?? '/upload');
            onUpload?.(result);
            setFileName(file.name);
          } catch {
            onUpload?.();
          }
        }}
      />
      {fileName ? (
        <p className="text-sm text-base-content/60">{fileName}</p>
      ) : value ? (
        <p className="text-sm text-base-content/60">{value}</p>
      ) : null}
    </div>
  );
}
