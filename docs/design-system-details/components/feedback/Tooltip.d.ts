import { ReactNode } from 'react';
/** @startingPoint section="Feedback" subtitle="Hover label" viewport="700x140" */
export interface TooltipProps {
  label: string;
  children?: ReactNode;
}
export function Tooltip(props: TooltipProps): JSX.Element;
export default Tooltip;
