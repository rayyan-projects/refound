import type { ButtonHTMLAttributes, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { iconButtonClasses } from './buttonStyles';
import type { IconButtonVariant } from './buttonStyles';

export type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md';
  variant?: IconButtonVariant;
  iconSize?: 16 | 20;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  iconSize = 16,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(iconButtonClasses(variant, size), className)}
      {...rest}
    >
      <Icon icon={icon} size={iconSize} />
    </button>
  );
}
