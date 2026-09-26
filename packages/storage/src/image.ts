/**
 * Image optimization — a sharp-backed pipeline that auto-orients via EXIF,
 * strips metadata by default, transcodes to WebP/JPEG/PNG (or keeps the source
 * format), and produces named resized variants. All output is returned as
 * Buffers so callers can hand it straight to a StorageAdapter.
 */
import sharp from 'sharp';

export interface ImageVariant {
  name: string;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'inside' | 'fill';
}

export interface OptimizedImage {
  buffer: Buffer;
  mimeType: string;
  format: string;
  width: number;
  height: number;
  size: number;
  variants: Array<{
    name: string;
    buffer: Buffer;
    width: number;
    height: number;
    size: number;
  }>;
}

export interface OptimizeImageOptions {
  /** Output format. `'original'` keeps the source format when it is webp/jpeg/png. */
  format?: OutputFormat;
  /** Quality for lossy formats (webp/jpeg), 1-100. Default 80. */
  quality?: number;
  /** Strip EXIF/IPTC/XMP metadata from the output. Default true. */
  stripMetadata?: boolean;
  /** Named resized variants to produce alongside the full-size output. */
  sizes?: ImageVariant[];
}

const FORMAT_MIME: Record<string, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

type OutputFormat = 'webp' | 'jpeg' | 'png' | 'original';
type EncodableFormat = Exclude<OutputFormat, 'original'>;

/** Resolves the requested output format; unknown source formats fall back to webp. */
function resolveFormat(
  format: OutputFormat,
  source: string | undefined,
): EncodableFormat {
  if (format !== 'original') return format;
  if (source === 'jpeg') return 'jpeg';
  if (source === 'png') return 'png';
  return 'webp';
}

interface EncodedImage {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

/** Applies EXIF orientation (and optional metadata retention), then transcodes. */
function encode(
  pipeline: sharp.Sharp,
  format: EncodableFormat,
  quality: number,
): Promise<EncodedImage> {
  const formatted =
    format === 'jpeg'
      ? pipeline.jpeg({ quality })
      : format === 'png'
        ? pipeline.png()
        : pipeline.webp({ quality });
  const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
  return formatted.toBuffer({ resolveWithObject: true }).then(({ data, info }) => ({
    buffer: data,
    width: info.width,
    height: info.height,
    size: info.size,
    mimeType,
  }));
}

/** Builds a pipeline that auto-orients via EXIF and (optionally) keeps metadata. */
function basePipeline(input: Buffer | Uint8Array, stripMetadata: boolean): sharp.Sharp {
  const pipeline = sharp(input).rotate();
  return stripMetadata ? pipeline : pipeline.withMetadata();
}

/**
 * Optimizes `input`: auto-orients, transcodes to `format` (webp by default),
 * and produces one buffer per named size in `sizes` alongside the full-size
 * output. Metadata is stripped unless `stripMetadata` is false.
 */
export async function optimizeImage(
  input: Buffer | Uint8Array,
  opts?: OptimizeImageOptions,
): Promise<OptimizedImage> {
  const format = opts?.format ?? 'webp';
  const quality = opts?.quality ?? 80;
  const stripMetadata = opts?.stripMetadata ?? true;
  const sizes = opts?.sizes ?? [];

  const meta = await sharp(input).metadata();
  const outputFormat = resolveFormat(format, meta.format);

  const original = await encode(basePipeline(input, stripMetadata), outputFormat, quality);

  const variants: OptimizedImage['variants'] = [];
  for (const variant of sizes) {
    const resize: sharp.ResizeOptions = {};
    if (variant.width !== undefined) resize.width = variant.width;
    if (variant.height !== undefined) resize.height = variant.height;
    if (variant.fit !== undefined) resize.fit = variant.fit;

    const encoded = await encode(
      basePipeline(input, stripMetadata).resize(resize),
      outputFormat,
      quality,
    );
    variants.push({
      name: variant.name,
      buffer: encoded.buffer,
      width: encoded.width,
      height: encoded.height,
      size: encoded.size,
    });
  }

  return {
    buffer: original.buffer,
    mimeType: original.mimeType,
    format: outputFormat,
    width: original.width,
    height: original.height,
    size: original.size,
    variants,
  };
}

/** Reads an image's dimensions and format without transforming it. */
export async function imageMetadata(
  input: Buffer | Uint8Array,
): Promise<{ width?: number; height?: number; format?: string; mimeType?: string }> {
  const meta = await sharp(input).metadata();
  const format = meta.format;
  return {
    width: meta.width,
    height: meta.height,
    format,
    mimeType: format ? FORMAT_MIME[format] : undefined,
  };
}
