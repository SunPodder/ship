/**
 * ShipConfirmDialog — a modal confirmation with a blurred backdrop. Used for
 * destructive actions (delete, bulk delete) instead of the native `confirm`.
 */

export interface ShipConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ShipConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ShipConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-base-content/20 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="card relative w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">{title}</h2>
          <p className="text-sm text-base-content/70">{message}</p>
          <div className="card-actions justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className="btn btn-neutral" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
