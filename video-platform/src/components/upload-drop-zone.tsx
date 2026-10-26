import type { ReactNode } from 'react';

export function UploadDropZone({ children }: { children: ReactNode; onFile: (file: File) => void }) {
  return <>{children}</>;
}
