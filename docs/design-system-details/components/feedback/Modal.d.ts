import { ReactNode } from 'react';
/** @startingPoint section="Feedback" subtitle="Centered dialog with backdrop" viewport="700x320" */
export interface ModalProps {
  open?: boolean;
  title?: string;
  children?: ReactNode;
  onClose?: () => void;
}
export function Modal(props: ModalProps): JSX.Element | null;
export default Modal;
