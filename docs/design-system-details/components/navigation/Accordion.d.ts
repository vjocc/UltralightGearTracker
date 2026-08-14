/** @startingPoint section="Navigation" subtitle="Expand/collapse Q&A list" viewport="700x260" */
export interface AccordionItem { title: string; body: string; }
export interface AccordionProps {
  items?: AccordionItem[];
  defaultOpen?: number;
}
export function Accordion(props: AccordionProps): JSX.Element;
export default Accordion;
