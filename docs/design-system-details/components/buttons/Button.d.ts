import { ReactNode, ButtonHTMLAttributes } from 'react';

/**
 * @startingPoint section="Buttons" subtitle="Pill CTA button — primary, outline, ghost" viewport="700x140"
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary/secondary are solid accent fills; outline/ghost are additions beyond the Figma source's single CTA style. */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
export default Button;
