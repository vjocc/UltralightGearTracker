/** @startingPoint section="Navigation" subtitle="Numbered page controls" viewport="700x100" */
export interface PaginationProps {
  page?: number;
  total?: number;
  onChange?: (page: number) => void;
}
export function Pagination(props: PaginationProps): JSX.Element;
export default Pagination;
