/**
 * ShipField — the field dispatcher. Renders the appropriate controlled input
 * for each `FieldDef` kind, honoring `required`/`min`/`max`/`default` metadata,
 * and delegates embedded documents, relations, and image/file uploads to their
 * dedicated sub-renderers.
 */

import { useEffect, useState, type ReactNode } from 'react';
import type {
  EmbeddedOptions,
  FieldDef,
  RelationOptions,
} from '@ship/core';
import { ShipFileUpload, ShipImageUpload } from './Upload';

export interface RelationOption {
  id: string;
  label: string;
}

export type RelationLookup = (q?: string) => Promise<RelationOption[]>;

export interface ShipFieldProps {
  name: string;
  def: FieldDef;
  value?: unknown;
  onChange: (value: unknown) => void;
  /** Humanized display label; defaults to the raw field name. */
  label?: string;
  /** Lookup functions for relation fields, keyed by target model name. */
  relations?: Record<string, RelationLookup>;
  /** Upload endpoint URL for image/file fields. */
  uploadUrl?: string;
}

function asString(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

/** Cast the discriminated-union options to a loose map for shared metadata reads. */
function opts(def: FieldDef): Record<string, unknown> {
  return def.options as unknown as Record<string, unknown>;
}

function isRequired(def: FieldDef): boolean {
  const o = opts(def);
  return o.required === true && o.nullable !== true;
}

/** Derive a short constraint hint from field options (e.g. "min 3 · max 200"). */
function helpText(def: FieldDef): string | null {
  const o = opts(def);
  const parts: string[] = [];
  if (o.unique === true) parts.push('unique');
  if (typeof o.minLength === 'number' && typeof o.maxLength === 'number') {
    parts.push(`${o.minLength}–${o.maxLength} chars`);
  } else if (typeof o.minLength === 'number') {
    parts.push(`min ${o.minLength} chars`);
  } else if (typeof o.maxLength === 'number') {
    parts.push(`max ${o.maxLength} chars`);
  }
  if (typeof o.min === 'number' && typeof o.max === 'number') {
    parts.push(`${o.min}–${o.max}`);
  } else if (typeof o.min === 'number') {
    parts.push(`min ${o.min}`);
  } else if (typeof o.max === 'number') {
    parts.push(`max ${o.max}`);
  }
  if (typeof o.maxSize === 'string') parts.push(`max ${o.maxSize}`);
  if (o.many === true) parts.push('multiple');
  if (def.kind === 'richText') parts.push('rich text');
  return parts.length ? parts.join(' · ') : null;
}

/** `metaTitle` → `Meta Title`. */
function humanize(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/** Label + control + hint, with the label bound to the control for focus. */
function formControl(
  caption: ReactNode,
  help: string | null,
  control: ReactNode,
): ReactNode {
  return (
    <label className="form-control">
      <div className="label py-1">
        <span className="label-text font-medium">{caption}</span>
      </div>
      {control}
      {help ? (
        <div className="label py-1">
          <span className="label-text-alt text-base-content/50">{help}</span>
        </div>
      ) : null}
    </label>
  );
}

/** Caption + composite control + hint, without a wrapping `<label>`. */
function fieldBlock(
  caption: ReactNode,
  help: string | null,
  control: ReactNode,
): ReactNode {
  return (
    <div className="space-y-1">
      <span className="label-text font-medium">{caption}</span>
      {control}
      {help ? (
        <span className="block text-xs text-base-content/50">{help}</span>
      ) : null}
    </div>
  );
}

/**
 * Relation picker — searchable combobox (single) or chip list (many). Falls
 * back to a plain id input when no lookup is supplied (e.g. in tests).
 */
function RelationField({
  def,
  value,
  onChange,
  lookup,
}: {
  def: { kind: 'relation'; options: RelationOptions };
  value: unknown;
  onChange: (value: unknown) => void;
  lookup?: RelationLookup;
}) {
  const many = def.options.many === true;
  const model = def.options.model ?? 'related';
  const [items, setItems] = useState<RelationOption[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!lookup) return;
    let active = true;
    lookup(query || undefined)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [query, lookup]);

  if (!lookup) {
    return (
      <input
        type="text"
        value={asString(value)}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="input input-bordered w-full"
        placeholder={`${model} id`}
      />
    );
  }

  const selectedIds: string[] = many
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : value
      ? [String(value)]
      : [];

  const selected = items.filter((item) => selectedIds.includes(item.id));

  function select(id: string) {
    if (many) {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      );
    } else {
      onChange(id);
      setQuery('');
      setOpen(false);
    }
  }

  return (
    <div className="space-y-2">
      {many && selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <span key={item.id} className="badge badge-ghost gap-1">
              {item.label}
              <button
                type="button"
                className="text-xs opacity-70 hover:opacity-100"
                onClick={() => select(item.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          type="text"
          value={
            query || (!many && selected[0] ? selected[0].label : asString(value))
          }
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
          }}
          placeholder={`Search ${model}…`}
          className="input input-bordered w-full"
        />
        {open && items.length > 0 ? (
          <ul className="menu absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-box border border-base-300 bg-base-100 shadow-lg">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onMouseDown={() => select(item.id)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Embedded document renderer — recursive sub-form. `many` renders an array
 * with add/remove controls.
 */
function EmbeddedField({
  def,
  value,
  onChange,
  relations,
  uploadUrl,
}: {
  def: { kind: 'embedded'; options: EmbeddedOptions };
  value: unknown;
  onChange: (value: unknown) => void;
  relations?: Record<string, RelationLookup>;
  uploadUrl?: string;
}) {
  const many = def.options.many === true;
  const schema = def.options.schema;

  if (many) {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-box border border-base-300 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-base-content/70">
                #{index + 1}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-error"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
            <div className="space-y-4">
              {Object.entries(schema).map(([subName, subDef]) => (
                <ShipField
                  key={subName}
                  name={subName}
                  label={humanize(subName)}
                  def={subDef}
                  value={item[subName]}
                  onChange={(v) =>
                    onChange(
                      items.map((it, i) =>
                        i === index ? { ...it, [subName]: v } : it,
                      ),
                    )
                  }
                  relations={relations}
                  uploadUrl={uploadUrl}
                />
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onChange([...items, {}])}
        >
          Add item
        </button>
      </div>
    );
  }

  const obj =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return (
    <div className="space-y-4 rounded-box border border-base-300 p-4">
      {Object.entries(schema).map(([subName, subDef]) => (
        <ShipField
          key={subName}
          name={subName}
          label={humanize(subName)}
          def={subDef}
          value={obj[subName]}
          onChange={(v) => onChange({ ...obj, [subName]: v })}
          relations={relations}
          uploadUrl={uploadUrl}
        />
      ))}
    </div>
  );
}

export function ShipField({
  name,
  def,
  value,
  onChange,
  label,
  relations,
  uploadUrl,
}: ShipFieldProps) {
  const help = helpText(def);
  const caption = (
    <>
      {label ?? name}
      {isRequired(def) ? <span className="ml-0.5 text-error">*</span> : null}
    </>
  );

  switch (def.kind) {
    case 'text':
    case 'url':
    case 'email':
    case 'password':
    case 'slug': {
      const o = opts(def);
      const type = def.kind === 'slug' ? 'text' : def.kind;
      return formControl(
        caption,
        help,
        <input
          name={name}
          type={type}
          value={asString(value)}
          onChange={(e) => onChange(e.currentTarget.value)}
          required={isRequired(def)}
          minLength={typeof o.minLength === 'number' ? o.minLength : undefined}
          maxLength={typeof o.maxLength === 'number' ? o.maxLength : undefined}
          className="input input-bordered w-full"
        />,
      );
    }

    case 'textarea':
    case 'richText':
      return formControl(
        caption,
        help,
        <textarea
          name={name}
          value={asString(value)}
          onChange={(e) => onChange(e.currentTarget.value)}
          className={`textarea textarea-bordered w-full ${
            def.kind === 'richText' ? 'min-h-40' : ''
          }`}
        />,
      );

    case 'json': {
      const text =
        typeof value === 'string'
          ? value
          : value == null
            ? ''
            : (JSON.stringify(value) ?? '');
      return formControl(
        caption,
        help,
        <textarea
          name={name}
          value={text}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            let next: unknown = raw;
            try {
              next = JSON.parse(raw);
            } catch {
              // Keep the raw string while the JSON is still being typed.
            }
            onChange(next);
          }}
          className="textarea textarea-bordered w-full"
        />,
      );
    }

    case 'integer':
    case 'decimal':
    case 'float': {
      const o = opts(def);
      return formControl(
        caption,
        help,
        <input
          name={name}
          type="number"
          value={asString(value)}
          onChange={(e) => {
            const raw = e.currentTarget.value;
            onChange(raw === '' ? undefined : Number(raw));
          }}
          required={isRequired(def)}
          min={typeof o.min === 'number' ? o.min : undefined}
          max={typeof o.max === 'number' ? o.max : undefined}
          step={def.kind === 'integer' ? 1 : undefined}
          className="input input-bordered w-full"
        />,
      );
    }

    case 'boolean':
      return (
        <label className="flex items-center justify-between gap-3 py-1">
          <span className="label-text font-medium">{caption}</span>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.currentTarget.checked)}
          />
        </label>
      );

    case 'select': {
      const options = def.options.options;
      return formControl(
        caption,
        help,
        <select
          name={name}
          value={asString(value)}
          onChange={(e) => onChange(e.currentTarget.value)}
          className="select select-bordered w-full"
        >
          {!isRequired(def) ? <option value="">Select…</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>,
      );
    }

    case 'multiSelect': {
      const options = def.options.options;
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return fieldBlock(
        caption,
        help,
        <div className="flex flex-wrap gap-1">
          {options.map((option) => {
            const active = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((x) => x !== option)
                      : [...selected, option],
                  )
                }
                className={`badge cursor-pointer ${
                  active ? 'badge-primary' : 'badge-ghost'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>,
      );
    }

    case 'datetime':
      return formControl(
        caption,
        help,
        <input
          name={name}
          type="datetime-local"
          value={asString(value)}
          onChange={(e) => onChange(e.currentTarget.value)}
          required={isRequired(def)}
          className="input input-bordered w-full"
        />,
      );

    case 'date':
      return formControl(
        caption,
        help,
        <input
          name={name}
          type="date"
          value={asString(value)}
          onChange={(e) => onChange(e.currentTarget.value)}
          required={isRequired(def)}
          className="input input-bordered w-full"
        />,
      );

    case 'time':
      return formControl(
        caption,
        help,
        <input
          name={name}
          type="time"
          value={asString(value)}
          onChange={(e) => onChange(e.currentTarget.value)}
          required={isRequired(def)}
          className="input input-bordered w-full"
        />,
      );

    case 'relation':
      return fieldBlock(
        caption,
        help,
        <RelationField
          def={def}
          value={value}
          onChange={onChange}
          lookup={relations?.[def.options.model ?? '']}
        />,
      );

    case 'image': {
      const accept = (def.options.accept ?? ['image/*']).join(',');
      return fieldBlock(
        caption,
        help,
        <ShipImageUpload
          name={name}
          accept={accept}
          value={asString(value)}
          url={uploadUrl}
          onUpload={(result) => onChange(result?.url ?? result?.key)}
        />,
      );
    }

    case 'file': {
      const accept = (def.options.accept ?? []).join(',');
      return fieldBlock(
        caption,
        help,
        <ShipFileUpload
          name={name}
          accept={accept}
          value={asString(value)}
          url={uploadUrl}
          onUpload={(result) => onChange(result?.url ?? result?.key)}
        />,
      );
    }

    case 'embedded':
      return fieldBlock(
        caption,
        help,
        <EmbeddedField
          def={def}
          value={value}
          onChange={onChange}
          relations={relations}
          uploadUrl={uploadUrl}
        />,
      );

    default: {
      // Exhaustiveness guard: a new `FieldDef` kind must be handled above.
      const _exhaustive: never = def;
      return _exhaustive;
    }
  }
}
