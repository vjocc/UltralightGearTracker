/** @startingPoint section="Forms" subtitle="Toggle switch" viewport="700x120" */
export interface SwitchProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}
export function Switch(props: SwitchProps): JSX.Element;
export default Switch;
