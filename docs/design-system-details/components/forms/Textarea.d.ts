import { TextareaHTMLAttributes } from 'react';
/** @startingPoint section="Forms" subtitle="Multi-line text field" viewport="700x220" */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  placeholder?: string;
  helpText?: string;
  rows?: number;
  disabled?: boolean;
}
export function Textarea(props: TextareaProps): JSX.Element;
export default Textarea;
