/**
 * ShipField — the field dispatcher. Renders the appropriate controlled input
 * for each `FieldDef` kind. Nested/embedded form rendering is out of scope:
 * an embedded field renders a placeholder `div`.
 */

import type { FieldDef } from '@ship/core';

export interface ShipFieldProps {
  name: string;
  def: FieldDef;
  value?: unknown;
  onChange: (value: unknown) => void;
}

function asString(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

export function ShipField({ name, def, value, onChange }: ShipFieldProps) {
  const caption = <span className="label-text">{name}</span>;

  switch (def.kind) {
    case 'text':
    case 'url':
    case 'email':
    case 'password':
    case 'slug': {
      const type = def.kind === 'slug' ? 'text' : def.kind;
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type={type}
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="input input-bordered"
          />
        </label>
      );
    }

    case 'textarea':
    case 'richText':
      return (
        <label className="form-control">
          {caption}
          <textarea
            name={name}
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="textarea textarea-bordered"
          />
        </label>
      );

    case 'json': {
      const text =
        typeof value === 'string'
          ? value
          : value == null
            ? ''
            : (JSON.stringify(value) ?? '');
      return (
        <label className="form-control">
          {caption}
          <textarea
            name={name}
            value={text}
            onChange={(e) => {
              const raw = e.currentTarget.value;
              let next: unknown = raw;
              try {
                next = JSON.parse(raw);
              } catch {
                // Keep the raw string when the JSON is still being typed.
              }
              onChange(next);
            }}
            className="textarea textarea-bordered"
          />
        </label>
      );
    }

    case 'integer':
    case 'decimal':
    case 'float':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="number"
            value={asString(value)}
            onChange={(e) => {
              const raw = e.currentTarget.value;
              onChange(raw === '' ? undefined : Number(raw));
            }}
            className="input input-bordered"
          />
        </label>
      );

    case 'boolean':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.currentTarget.checked)}
            className="checkbox"
          />
        </label>
      );

    case 'select':
      return (
        <label className="form-control">
          {caption}
          <select
            name={name}
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="select select-bordered"
          >
            {def.options.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );

    case 'multiSelect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <label className="form-control">
          {caption}
          <select
            name={name}
            multiple
            value={selected}
            onChange={(e) => {
              onChange(Array.from(e.currentTarget.selectedOptions, (o) => o.value));
            }}
            className="select select-bordered"
          >
            {def.options.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      );
    }

    case 'datetime':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="datetime-local"
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="input input-bordered"
          />
        </label>
      );

    case 'date':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="date"
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="input input-bordered"
          />
        </label>
      );

    case 'time':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="time"
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="input input-bordered"
          />
        </label>
      );

    case 'relation':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="text"
            value={asString(value)}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="input input-bordered"
          />
        </label>
      );

    case 'image':
    case 'file':
      return (
        <label className="form-control">
          {caption}
          <input
            name={name}
            type="file"
            onChange={(e) => onChange(e.currentTarget.files)}
            className="file-input"
          />
        </label>
      );

    case 'embedded':
      return <div>embedded</div>;

    default: {
      // Exhaustiveness guard: a new `FieldDef` kind must be handled above.
      const _exhaustive: never = def;
      return _exhaustive;
    }
  }
}
