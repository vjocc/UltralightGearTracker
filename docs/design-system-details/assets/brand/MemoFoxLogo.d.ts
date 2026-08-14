import * as React from 'react';
export interface MemoFoxLogoProps {
  className?: string;
  style?: React.CSSProperties;
  color?: boolean;
  vertical?: boolean;
  /** Swappable nested instance; defaults to the design's. */
  icon1?: React.ReactNode;
}
export declare const MemoFoxLogo: React.FC<MemoFoxLogoProps>;
export default MemoFoxLogo;
