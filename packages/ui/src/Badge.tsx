/**
 * ShipBadge — a small presentational status pill with daisyUI tone styles.
 */

import type { ReactNode } from 'react';

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-error',
};

export function ShipBadge({ children, tone = 'default' }: BadgeProps) {
  return <span className={`badge ${TONE_CLASSES[tone]}`}>{children}</span>;
}
