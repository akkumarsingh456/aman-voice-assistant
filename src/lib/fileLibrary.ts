// Per-user file library: upload an attachment to a private bucket, list saved
// items, and re-hydrate them back into the chat as ChatAttachment objects.
import { supabase } from "@/integrations/supabase/client";
import type { ChatAttachment } from "@/lib/readFiles";

export type LibraryFile = {
  id: string;
  name: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

const BUCKET = "user-files";
const TEXTY = /^(text\/|application\/(json|xml|javascript))/;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Save a freshly-attached file (or a base64 dataUrl-backed one) to the library. */
export async function saveAttachmentToLibrary(att: ChatAttachment): Promise<LibraryFile> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw new Error("Sign-in required");

  let blob: Blob;
  if (att.dataUrl) {
    const res = await fetch(att.dataUrl);
    blob = await res.blob();
  } else {
    blob = new Blob([att.text ?? ""], { type: att.mimeType || "text/plain" });
  }

  const safeName = att.name.replace(/[^\w.\-]+/g, "_");
  const path = `${uid}/${Date.now()}-${safeName}`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: att.mimeType,
    upsert: false,
  });
  if (up.error) throw up.error;

  const ins = await supabase
    .from("user_files")
    .insert({
      user_id: uid,
      name: att.name,
      path,
      mime_type: att.mimeType,
      size_bytes: blob.size,
    })
    .select("*")
    .single();
  if (ins.error) throw ins.error;
  return ins.data as LibraryFile;
}

export async function listLibrary(): Promise<LibraryFile[]> {
  const { data, error } = await supabase
    .from("user_files")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as LibraryFile[];
}

export async function deleteFromLibrary(file: LibraryFile): Promise<void> {
  await supabase.storage.from(BUCKET).remove([file.path]);
  const { error } = await supabase.from("user_files").delete().eq("id", file.id);
  if (error) throw error;
}

/** Re-import a saved file as a ChatAttachment ready to send. */
export async function importFromLibrary(file: LibraryFile): Promise<ChatAttachment> {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.path);
  if (error || !data) throw error ?? new Error("download failed");
  if (TEXTY.test(file.mime_type)) {
    const text = await data.text();
    return { name: file.name, mimeType: file.mime_type, text };
  }
  const dataUrl = await blobToDataUrl(data);
  return { name: file.name, mimeType: file.mime_type, dataUrl };
}
