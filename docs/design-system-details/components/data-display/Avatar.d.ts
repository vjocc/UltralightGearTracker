/** @startingPoint section="Data display" subtitle="Round avatar — photo or initials" viewport="700x120" */
export interface AvatarProps {
  src?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
}
export function Avatar(props: AvatarProps): JSX.Element;
export default Avatar;
