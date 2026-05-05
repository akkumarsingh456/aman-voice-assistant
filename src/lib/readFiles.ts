// Read a File into the attachment shape expected by /api/chat.
// Text-like files are decoded inline; binaries become base64 data URLs.
export type ChatAttachment = {
  name: string;
  mimeType: string;
  text?: string;
  dataUrl?: string;
};

const TEXT_EXT = /\.(txt|md|markdown|html?|xml|json|csv|tsv|log|js|jsx|ts|tsx|css|scss|py|java|c|cpp|h|rb|go|rs|sh|yml|yaml|toml|ini|env|sql)$/i;

function isTextLike(file: File): boolean {
  if (file.type.startsWith("text/")) return true;
  if (/json|xml|javascript|html|csv/.test(file.type)) return true;
  if (TEXT_EXT.test(file.name)) return true;
  return false;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export async function readFileForChat(file: File): Promise<ChatAttachment> {
  const mimeType = file.type || "application/octet-stream";
  if (isTextLike(file)) {
    const text = await readAsText(file);
    return { name: file.name, mimeType, text };
  }
  const dataUrl = await readAsDataURL(file);
  return { name: file.name, mimeType, dataUrl };
}

export async function readFilesForChat(files: FileList | File[]): Promise<ChatAttachment[]> {
  const arr = Array.from(files);
  return Promise.all(arr.map(readFileForChat));
}
