import { useState, type DragEvent, type ReactNode } from 'react';

export function UploadDropZone({ children, onFile }: { children: ReactNode; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragging(false);
    const file = event.dataTransfer.files.item(0);
    if (file) onFile(file);
  };
  return <div
    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={onDrop}
    style={{ border: `1px dashed ${dragging ? '#ff3434' : '#444'}`, borderRadius: 12, padding: 4 }}
  >{children}</div>;
}
