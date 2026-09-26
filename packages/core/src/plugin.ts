/**
 * Plugin API — `definePlugin()` and `defineField()` give plugins a way to
 * register custom fields, routes, admin pages, and commands without coupling
 * to Ship's internals. The returned values are plain, structural data that
 * the code generator and runtime can inspect.
 */

/** A custom field contributed by a plugin. */
export interface ShipPluginField {
  kind: string;
  options: object;
}

/**
 * Declares a plugin-provided field. `kind` is a string the generator emits
 * verbatim; `options` holds whatever shape the plugin's own field handler
 * understands.
 */
export function defineField<K extends string, O extends object = object>(
  kind: K,
  options: O = {} as O,
): { kind: K; options: O } {
  return { kind, options };
}

/** A Ship plugin — a bag of optional, structural extensions. */
export interface ShipPlugin {
  name: string;
  version?: string;
  configSchema?: unknown;
  setup?: (config: unknown, shipConfig: unknown) => void | Promise<void>;
  fields?: Record<string, ShipPluginField>;
  routes?: (app: unknown) => void;
  adminPages?: Array<{ path: string; component: string }>;
  commands?: Array<{
    name: string;
    run: (args: unknown) => unknown | Promise<unknown>;
  }>;
}

/** Typed identity helper — returns the plugin unchanged. */
export function definePlugin<P extends ShipPlugin>(plugin: P): P {
  return plugin;
}
