'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sileo } from 'sileo';
import 'sileo/styles.css';

type ToasterProps = React.ComponentProps<typeof Sileo>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return <Sileo theme={theme as ToasterProps['theme']} {...props} />;
};

export { Toaster };
