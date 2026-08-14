/** @startingPoint section="Forms" subtitle="Dropdown select with custom menu" viewport="700x220" */
export interface SelectProps {
  label?: string;
  options?: string[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}
export function Select(props: SelectProps): JSX.Element;
export default Select;
