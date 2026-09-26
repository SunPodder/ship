/**
 * ShipImageUpload / ShipFileUpload — file-upload widgets that POST a `file`
 * field to an upload endpoint and surface the parsed result through `onUpload`.
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
  value?: string;
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
export function ShipImageUpload({ name, accept, label, url, onUpload }: UploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <>
      {label ? <label>{label}</label> : null}
      <input
        type="file"
        name={name}
        accept={accept}
        className="file-input"
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
      {preview ? <img src={preview} alt="" /> : null}
    </>
  );
}

/** File upload widget that shows the selected file name. */
export function ShipFileUpload({ name, accept, label, url, onUpload }: UploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      {label ? <label>{label}</label> : null}
      <input
        type="file"
        name={name}
        accept={accept}
        className="file-input"
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
      {fileName ? <span>{fileName}</span> : null}
    </>
  );
}
