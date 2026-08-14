/** @startingPoint section="Forms" subtitle="Radio button, single-select" viewport="700x120" */
export interface RadioProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}
export function Radio(props: RadioProps): JSX.Element;
export default Radio;
