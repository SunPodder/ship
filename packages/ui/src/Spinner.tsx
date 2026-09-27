/**
 * ShipSpinner — daisyUI loading spinner. Sized via the `className` passthrough
 * (`loading-sm`, `loading-md`, `loading-lg`).
 */

export function ShipSpinner({ className = 'loading-md' }: { className?: string }) {
  return (
    <span className={`loading loading-spinner ${className}`} aria-label="Loading" />
  );
}
