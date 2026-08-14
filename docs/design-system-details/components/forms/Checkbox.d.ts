/** @startingPoint section="Forms" subtitle="Checkbox with checked/disabled states" viewport="700x120" */
export interface CheckboxProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
export default Checkbox;
