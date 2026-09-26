/**
 * ShipButton — a controlled, presentational button with daisyUI variant styles.
 */

import type { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-error',
  ghost: 'btn-ghost',
};

export function ShipButton({
  children,
  variant = 'primary',
  type,
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      disabled={disabled}
      className={`btn ${VARIANT_CLASSES[variant]}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
