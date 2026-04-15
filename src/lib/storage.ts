import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Faz upload de um arquivo para o Supabase Storage (bucket nexus_files)
 * @param file - Arquivo a ser enviado
 * @returns URL assinada (signed URL) do arquivo ou null em caso de erro
 * NOTA: O bucket é privado, então usamos Signed URLs em vez de Public URLs
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

    // Criar URL assinada (bucket privado - não usa URL pública)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("nexus_files")
      .createSignedUrl(filePath, 60 * 60 * 24); // 24 horas de validade

    if (signedError) {
      console.error("Erro ao criar URL assinada:", signedError);
      toast.error("Erro ao gerar link do arquivo", { id: toastId });
      return null;
    }

    toast.success(`${file.name} enviado com sucesso!`, { id: toastId });
    return signedData.signedUrl;
  } catch (error) {
    console.error("Erro inesperado no upload:", error);
    toast.error("Erro inesperado ao enviar arquivo", { id: toastId });
    return null;
  }
}

/**
 * Obtém uma URL assinada (signed URL) para um arquivo existente
 * Útil para acessar arquivos em bucket privado
 * @param filePath - Caminho do arquivo no storage
 * @param expiresIn - Tempo de expiração em segundos (padrão: 1 hora)
 * @returns URL assinada ou null em caso de erro
 */
export async function getSignedFileUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("nexus_files")
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Erro ao criar URL assinada:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Erro ao obter URL assinada:", error);
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
