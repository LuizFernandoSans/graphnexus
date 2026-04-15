import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Faz upload de um arquivo para o Supabase Storage (bucket nexus_files)
 * @param file - Arquivo a ser enviado
 * @returns URL pública do arquivo ou null em caso de erro
 */
export async function uploadFile(file: File): Promise<string | null> {
  const toastId = toast.loading(`Enviando ${file.name}...`);

  try {
    // Obter usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado para fazer upload", { id: toastId });
      return null;
    }

    // Criar caminho único: userId/timestamp-nomeDoArquivo
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${user.id}/${timestamp}-${sanitizedName}`;

    // Fazer upload
    const { error: uploadError } = await supabase.storage
      .from("nexus_files")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Erro no upload:", uploadError);
      toast.error(`Erro ao enviar: ${uploadError.message}`, { id: toastId });
      return null;
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from("nexus_files")
      .getPublicUrl(filePath);

    toast.success(`${file.name} enviado com sucesso!`, { id: toastId });
    return publicUrl;
  } catch (error) {
    console.error("Erro inesperado no upload:", error);
    toast.error("Erro inesperado ao enviar arquivo", { id: toastId });
    return null;
  }
}

/**
 * Verifica se um arquivo é uma imagem
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Verifica se um arquivo é um documento suportado (PDF, DOC, DOCX, TXT)
 */
export function isDocumentFile(file: File): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  return supportedTypes.includes(file.type);
}

/**
 * Formata o tamanho do arquivo para exibição
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
