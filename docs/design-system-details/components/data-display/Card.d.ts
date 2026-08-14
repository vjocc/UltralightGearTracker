import { ReactNode, CSSProperties } from 'react';
/** @startingPoint section="Data display" subtitle="Content container — light, white or dark (step-card) tone" viewport="700x260" */
export interface CardProps {
  tone?: 'light' | 'white' | 'dark';
  padding?: 'sm' | 'md' | 'lg';
  radius?: 'sm' | 'md' | 'lg' | 'xl' | 'pill';
  shadow?: 'none' | 'sm' | 'md' | 'xl';
  children?: ReactNode;
  style?: CSSProperties;
}
export function Card(props: CardProps): JSX.Element;
export default Card;
