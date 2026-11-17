import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { Spinner } from './Spinner';
import { buttonClasses } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
}

export type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; ref?: Ref<HTMLButtonElement> };

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  type = 'button',
  autoFocus,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      autoFocus={autoFocus}
      data-autofocus={autoFocus ? '' : undefined}
      className={clsx(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading ? <Spinner label="Working" /> : icon ? <Icon icon={icon} /> : null}
      {children}
      {iconRight && <Icon icon={iconRight} />}
    </button>
  );
}

export type ButtonLinkProps = CommonProps & LinkProps & { disabled?: boolean };

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  children,
  className,
  disabled,
  onClick,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={clsx(buttonClasses(variant, size, true), disabled && 'pointer-events-none', className)}
      {...rest}
    >
      {icon && <Icon icon={icon} />}
      {children}
      {iconRight && <Icon icon={iconRight} />}
    </Link>
  );
}
