import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function ProcessLayout({ children }: Props) {
  return <div className="space-y-4 p-6">{children}</div>;
}
