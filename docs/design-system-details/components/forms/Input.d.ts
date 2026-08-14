import { InputHTMLAttributes, ReactNode } from 'react';
/** @startingPoint section="Forms" subtitle="Text field with label, help text and error state" viewport="700x320" */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  placeholder?: string;
  helpText?: string;
  error?: string;
  icon?: ReactNode;
  disabled?: boolean;
}
export function Input(props: InputProps): JSX.Element;
export default Input;
