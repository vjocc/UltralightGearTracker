import { ReactNode } from 'react';
/** @startingPoint section="Data display" subtitle="Small status/category pill" viewport="700x100" */
export interface BadgeProps {
  tone?: 'neutral' | 'purple' | 'orange' | 'teal';
  children?: ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
export default Badge;
