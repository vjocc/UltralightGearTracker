import { ReactNode } from 'react';
/** @startingPoint section="Feedback" subtitle="Inline banner — info/success/warning/danger" viewport="700x160" */
export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
}
export function Alert(props: AlertProps): JSX.Element;
export default Alert;
