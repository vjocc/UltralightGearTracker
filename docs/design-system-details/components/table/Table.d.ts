/** @startingPoint section="Data display" subtitle="Simple data table" viewport="700x260" */
export interface TableProps {
  columns?: string[];
  rows?: string[][];
}
export function Table(props: TableProps): JSX.Element;
export default Table;
