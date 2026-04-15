# 🔍 Revisão Técnica Completa - GraphNexus

**Data:** 15/04/2026  
**Escopo:** RichTextEditor + Uploads, Busca Profunda, Extração de Conhecimento  
**Status:** ⚠️ **PROBLEMAS CRÍTICOS ENCONTRADOS**

---

## 🚨 BUGS E ERROS CRÍTICOS

### 1. **Race Condition na Mutação Tripla (CRÍTICO)**

**Arquivos:** `TaskDetail.tsx` (linhas 143-181), `ProjectDetail.tsx` (linhas 127-165)

**Problema:** Se a criação da nota (passo 1) falhar APÓS criar o link (passo 2) ou APÓS limpar a descrição (passo 3), o sistema ficará em estado inconsistente:
- Nota criada sem link → Órfã no sistema
- Link criado mas nota falhou → Link quebrado
- Descrição limpa mas nota falhou → Perda de dados irreversível

**Código Problemático:**
```tsx
const extractMutation = useMutation({
  mutationFn: async () => {
    // 1. Criar nota
    const note = await createNote({...}); // Se falhar aqui: OK, nada foi feito
    
    // 2. Criar link
    await createEntityLink({...}); // Se falhar aqui: nota órfã criada
    
    // 3. Limpar descrição
    await updateTask(id, { description: "" }); // Se falhar aqui: link existe, descrição ainda lá
  },
});
```

**Impacto:** ⭐⭐⭐⭐⭐ Perda de dados, inconsistência no grafo

**Solução Recomendada:**
- Usar transação do Supabase (se disponível) OU
- Implementar rollback manual: se passo 2 ou 3 falharem, deletar a nota criada
- Ou mudar ordem: limpar origem primeiro (mais seguro, pois ação é reversível via undo)

```tsx
// Abordagem mais segura:
const extractMutation = useMutation({
  mutationFn: async () => {
    const descriptionBackup = description;
    
    try {
      // 1. Criar nota primeiro (ação mais segura - criar é mais fácil de desfazer)
      const note = await createNote({ title: `Ref: ${task.title}`, content: descriptionBackup });
      
      // 2. Criar link (relativamente seguro)
      await createEntityLink({...});
      
      // 3. Por último, limpar descrição (ação destrutiva por último)
      await updateTask(id, { description: "" });
      
      return note;
    } catch (error) {
      // Se algo falhou após criar nota, tentar limpar
      // (não podemos fazer muito sem transações, mas podemos logar)
      throw error;
    }
  },
});
```

---

### 2. **Falta de Tratamento de Cancelamento no File Input**

**Arquivo:** `RichTextEditor.tsx` (linhas 339-361)

**Problema:** Quando o usuário abre o seletor de arquivo e clica em "Cancelar", `e.target.files` é `null` ou `undefined`, e `e.target.files?.[0]` retorna `undefined`. A função `handleUpload` trata isso com `if (!file) return;`, mas o valor do input não é resetado.

**Código Atual:**
```tsx
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  hidden
  onChange={(e) => handleUpload(e.target.files?.[0])}
/>
```

**Problema Secundário:** Se o usuário selecionar o mesmo arquivo novamente, `onChange` não dispara porque o valor do input não mudou.

**Solução:**
```tsx
const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    handleUpload(file);
  }
  // CRÍTICO: Resetar o input para permitir re-seleção do mesmo arquivo
  e.target.value = '';
}, [handleUpload]);

// Nos inputs:
<input
  ref={cameraInputRef}
  type="file"
  accept="image/*"
  capture="environment"
  hidden
  onChange={handleFileChange}
/>
```

---

### 3. **Escape de Caracteres Especiais na Busca (MÉDIO)**

**Arquivos:** `CommandPalette.tsx` (linhas 39-46), `notes.ts` (linha 20)

**Problema:** O `escapeLikePattern` está sendo aplicado DEPOIS de adicionar os wildcards `%` na `CommandPalette`:

```tsx
// CommandPalette.tsx linha 41
const q = `%${escapeLikePattern(query)}%`; // ❌ Wildcards fora do escape

// Depois na query:
.or(`title.ilike.${q},content.ilike.${q}`) // ❌ q já contém % não escapados!
```

Isso significa que se o usuário digitar literalmente `%` na busca, ele será escapado como `\%`, mas os wildcards que ADICIONAMOS (`%${q}%`) não estão escapados.

**Comportamento Esperado:**
- Buscar `test` → `%test%` (encontra "testing")
- Buscar `%test` → `\%test%` (encontra literal "%test")

**Comportamento Atual:** Funciona por coincidência, mas se query contém `%` ou `_`, pode haver comportamento inesperado.

**Solução:**
```tsx
// CORRETO: Escapar PRIMEIRO, depois adicionar wildcards
const escaped = escapeLikePattern(query);
const q = `%${escaped}%`;
```

O código atual está funcionando, mas é frágil.

---

### 4. **Canvas Node Filtering - Problema de Performance (BAIXO)**

**Arquivo:** `Graph.tsx` (linhas 154-191)

**Problema:** A função `nodeCanvasObject` é chamada a cada frame do canvas (60fps). Dentro dela, chamamos `nodeMatchesSearch` que faz:

```tsx
const searchableText = [
  node.label,
  node.content,
  node.description,
].filter(Boolean).join(" ").toLowerCase();
return searchableText.includes(term);
```

Isso concatena strings e faz `toLowerCase()` a cada frame para cada nó! Com 100 nós a 60fps = 6000 operações de string por segundo.

**Solução:** Pré-calcular valores em `useMemo`:

```tsx
// Fora do canvas object, pré-calcular
const searchResults = useMemo(() => {
  if (!graphSearch.trim()) return new Set<string>(data?.nodes.map(n => n.id) || []);
  
  const term = graphSearch.toLowerCase();
  return new Set(
    data?.nodes.filter(node => {
      const text = [node.label, node.content, node.description]
        .filter(Boolean).join(" ").toLowerCase();
      return text.includes(term);
    }).map(n => n.id) || []
  );
}, [data, graphSearch]);

// No canvas object, lookup O(1):
const matchesSearch = searchResults.has(node.id);
```

---

### 5. **hasUnsavedChanges Conflito (MÉDIO)**

**Arquivo:** `TaskDetail.tsx` (linha 170), `ProjectDetail.tsx` (linha 153)

**Problema:** Após extração bem-sucedida, fazemos:
```tsx
setDescription("");
setHasUnsavedChanges(false);
```

Mas o `RichTextEditor` pode ter um ciclo de renderização pendente. Se o componente editor chamar `onChange` após nós setarmos descrição para vazio (devido à sincronização de props), pode re-triggerar `markChanged()` e setar `hasUnsavedChanges = true` novamente.

**Verificação:** O `RichTextEditor` tem este efeito:
```tsx
useEffect(() => {
  if (editor && content !== editor.getHTML()) {
    editor.commands.setContent(content, { emitUpdate: false });
  }
}, [content]);
```

Com `{ emitUpdate: false }`, não deve chamar `onChange`, então está **parcialmente seguro**, mas depende de timing.

**Recomendação:** Adicionar um flag de "extraindo" para desabilitar o editor durante a operação.

---

## ⚠️ INCONSISTÊNCIAS

### 6. **Link "Bidirecional" é Unidirecional (MÉDIO)**

**Arquivos:** `TaskDetail.tsx` (linhas 154-161), `ProjectDetail.tsx` (linhas 138-145)

**Problema:** O link criado é:
```tsx
await createEntityLink({
  source_type: "note",
  source_id: note.id,
  target_type: "task", // ou "project"
  target_id: id,
  label: "Extraído da descrição",
});
```

Isso cria UM registro na tabela `entity_links` com direção `note → task`. O sistema pode ou não tratar isso como bidirecional dependendo das queries.

**Verificação necessária:** Como `LinkPanel` e o grafo buscam links?

Se a query for assim:
```sql
SELECT * FROM entity_links 
WHERE source_id = :entityId OR target_id = :entityId
```

Então funciona (bidirecional em uso). Mas se for:
```sql
SELECT * FROM entity_links 
WHERE source_id = :entityId
```

Então o task/projeto NÃO mostra o link (porque ele é target, não source).

**Recomendação:** Verificar `LinkPanel.tsx` e `fetchEntityLinks` em `links.ts`. A função atual:
```tsx
.or(`and(source_id.eq.${entityId},source_type.eq.${entityType}),and(target_id.eq.${entityId},target_type.eq.${entityType})`)
```

Isso cobre ambos os casos, então **está funcionando**, mas semanticamente confuso.

**Melhoria:** Criar dois links (note↔task e task↔note) OU documentar que a direção é note→task.

---

### 7. **HTML na Descrição - Rendering Inconsistente (MÉDIO)**

**Problema:** Agora `description` em tasks/projetos contém HTML (do RichTextEditor). Outros lugares do app podem estar mostrando isso como texto cru.

**Locais a verificar:**
- Cards de lista de tarefas (provavelmente mostram apenas título, OK)
- Previews no grafo: `Graph.tsx` linha 147 `description` - mostra no canvas?
- Previews no `LinkPanel`: pode estar renderizando HTML ou texto

No `Graph.tsx` (linhas 61-66):
```tsx
(notes.data || []).forEach((n) => {
  nodes.push({ ..., content: n.content, ... }); // content é HTML
});
```

E `nodeMatchesSearch` (linhas 143-152) concatena `content` (HTML) na busca! Então a busca no grafo está buscando em tags HTML também:

```tsx
// Se content = "<p>teste</p>", searchableText = "... <p>teste</p> ..."
// Buscar "p>" vai dar match! ❌
```

**Solução:** Extrair texto puro do HTML antes de buscar:

```tsx
function extractTextFromHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || '';
}

const searchableText = [
  node.label,
  extractTextFromHtml(node.content || ''),
  extractTextFromHtml(node.description || ''),
].filter(Boolean).join(" ").toLowerCase();
```

---

### 8. **Título da Nota Extraída - Possível undefined (BAIXO)**

**Arquivo:** `TaskDetail.tsx` (linha 150), `ProjectDetail.tsx` (linha 134)

**Problema:**
```tsx
title: `Ref: ${task.title}`, // ou project.title
```

Se `task` ou `project` forem undefined no momento da execução (race condition), o título será `"Ref: undefined"`.

A verificação `if (!description || !id || !task)` na linha 146 deveria proteger, mas depende de quando o closure foi criado.

**Recomendação:** Verificação dupla:
```tsx
title: `Ref: ${task?.title || 'Sem título'}`,
```

---

## 🔒 PROBLEMAS DE SEGURANÇA

### 9. **XSS via RichTextEditor - Sanitização AUSENTE (CRÍTICO)**

**Arquivos:** Todos que usam `RichTextEditor` e exibem conteúdo

**Problema:** O Tiptap gera HTML, mas NÃO sanitiza contra XSS. Um usuário pode colar:
```html
<img src=x onerror=alert('XSS')>
```

Isso será salvo no banco e, quando exibido com `dangerouslySetInnerHTML` (ou equivalente), executará código.

**Locais de risco:**
- `Notes.tsx` (linha 179-185): Extrai texto com DOMParser (OK, seguro)
- Páginas de detalhe: Podem renderizar HTML?
- `Graph.tsx`: Busca em conteúdo (não renderiza, apenas busca - parcialmente seguro)

**Solução:**
1. **Salvando:** Adicionar DOMPurify antes de salvar
2. **Renderizando:** Adicionar DOMPurify ao exibir

```tsx
// Instalar: npm install dompurify
import DOMPurify from 'dompurify';

// No RichTextEditor, antes de chamar onChange:
const sanitizedHtml = DOMPurify.sanitize(editor.getHTML());
onChange(sanitizedHtml);
```

Ou configurar Tiptap para usar schema restrito.

---

### 10. **URL Pública sem Validação (BAIXO)**

**Arquivo:** `storage.ts` (linhas 39-45)

**Problema:**
```tsx
const { data: { publicUrl } } = supabase.storage
  .from("nexus_files")
  .getPublicUrl(filePath);

return publicUrl; // Retorna qualquer URL
```

A URL é gerada pelo Supabase, então é relativamente segura, mas se o Supabase retornar uma URL malformada ou vazia, ela será inserida no editor.

**Recomendação:**
```tsx
if (!publicUrl || !publicUrl.startsWith('http')) {
  toast.error("URL inválida gerada");
  return null;
}
```

---

### 11. **Políticas RLS do Storage - Verificação (OK)**

**Arquivo:** `20260415180000_create_nexus_files_bucket.sql`

**Verificação:**
```sql
CREATE POLICY "nexus_files_select_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'nexus_files' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Status:** ✅ **CORRETO**
- Verifica `bucket_id`
- Verifica se `auth.uid()` bate com a primeira pasta do path `(storage.foldername(name))[1]`

**Nota:** Em buckets públicos, a política de SELECT é necessária apenas se quisermos LISTAR arquivos. Para acessar URL pública direta, não é necessária política. Mas como estamos usando, está OK.

---

## ⚡ PERFORMANCE E OTIMIZAÇÃO

### 12. **CommandPalette - Debounce OK, mas sem Cancelamento (MÉDIO)**

**Arquivo:** `CommandPalette.tsx` (linhas 60-66)

**Status do Debounce:** ✅ **OK** - Usa `useDebouncedValue` (300ms)

**Problema:** Não há cancelamento de requisições antigas. Se o usuário digitar rápido:
1. Digita "a" → debounce → requisição A
2. Digita "ab" → debounce → requisição B
3. Requisição B completa primeiro
4. Requisição A completa depois → **sobrescreve resultados com dados antigos**

**Solução:** Usar `AbortController` ou verificar se a query ainda é relevante:

```tsx
const { data: results = [] } = useQuery({
  queryKey: ["cmd-search", debouncedSearch],
  queryFn: async ({ signal }) => {
    // React Query passa signal - usar nas requisições
    return searchAll(debouncedSearch, signal);
  },
  enabled: open && debouncedSearch.length > 0,
});

// searchAll precisa aceitar signal:
async function searchAll(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  // ...
  const [notes, tasks, projects] = await Promise.all([
    supabase.from("notes").select(...).abortSignal(signal),
    // ...
  ]);
}
```

**Nota:** O Supabase JS client não suporta `AbortController` nativamente. Alternativa: usar React Query's `queryFn` retornando Promise que pode ser ignorada se nova query chegar.

O React Query automaticamente cancela queries antigas quando a query key muda! Então na prática, **já está funcionando** (React Query >= 3.x).

---

### 13. **Cache Invalidation na Extração (PARCIAL)**

**Arquivo:** `TaskDetail.tsx` (linhas 172-175)

**Código atual:**
```tsx
queryClient.invalidateQueries({ queryKey: ["tasks"] });
queryClient.invalidateQueries({ queryKey: ["task", id] });
queryClient.invalidateQueries({ queryKey: ["notes"] });
queryClient.invalidateQueries({ queryKey: ["links"] });
```

**Problema:** `["links"]` é muito genérico. Se `LinkPanel` usa query key específica como `["links", entityId, entityType]`, a invalidação pode não funcionar.

**Verificar:** Como `LinkPanel` busca links? Se usar `fetchEntityLinks` em `links.ts`, qual é a query key?

Se não invalidar corretamente, o `LinkPanel` não mostra o novo link até refresh manual.

**Solução mais agressiva (recomendada):**
```tsx
queryClient.invalidateQueries({ queryKey: ["links"] }); // Todos os links
queryClient.refetchQueries({ queryKey: ["links"], type: 'active' }); // Força refetch imediato
```

Ou invalidar chaves específicas usadas por `LinkPanel`.

---

## 📝 QUALIDADE DE CÓDIGO

### 14. **Duplicação de Código - Extração (MÉDIO)**

**Arquivos:** `TaskDetail.tsx` (linhas 143-181) vs `ProjectDetail.tsx` (linhas 127-165)

**Problema:** Código idêntico duplicado entre Task e Project:
- Mesma lógica de extração
- Mesma estrutura de mutation
- Mesmo tratamento de erro
- Mesmo fluxo de diálogo

**Diferença apenas:**
- `task` vs `project`
- `"task"` vs `"project"` no target_type
- `updateTask` vs `updateProject`

**Solução:** Hook customizado `useExtractToNote`:

```tsx
// hooks/useExtractToNote.ts
export function useExtractToNote(
  entityType: 'task' | 'project',
  entityId: string | undefined,
  entity: { title: string } | undefined,
  description: string,
  onSuccess: () => void
) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      if (!description || !entityId || !entity) throw new Error("Dados incompletos");
      
      const note = await createNote({
        title: `Ref: ${entity.title}`,
        content: description,
      });
      
      await createEntityLink({
        source_type: "note",
        source_id: note.id,
        target_type: entityType,
        target_id: entityId,
        label: "Extraído da descrição",
      });
      
      if (entityType === 'task') {
        await updateTask(entityId, { description: "" });
      } else {
        await updateProject(entityId, { description: "" });
      }
      
      return note;
    },
    onSuccess: () => {
      onSuccess();
      queryClient.invalidateQueries({ queryKey: [entityType === 'task' ? "tasks" : "projects"] });
      queryClient.invalidateQueries({ queryKey: [entityType === 'task' ? "task" : "project", entityId] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["links"] });
      toast.success("Nota extraída e vinculada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao extrair: ${error instanceof Error ? error.message : "Erro desconhecido"}`);
    },
  });
}
```

---

### 15. **Detecção de Tipo de Arquivo (OK)**

**Arquivo:** `storage.ts` (linhas 56-71)

**Status:** ✅ **OK**

```tsx
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isDocumentFile(file: File): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/msword",
    // ...
  ];
  return supportedTypes.includes(file.type);
}
```

Usa `file.type` (MIME type), não extensão. Mais confiável.

---

### 16. **Reset do Input de Arquivo (AUSENTE - CRÍTICO)**

Já documentado no item #2. Necessário para permitir re-upload do mesmo arquivo.

---

## 📊 RESUMO EXECUTIVO

| Severidade | Quantidade | Itens |
|------------|-----------|-------|
| 🔴 **CRÍTICO** | 3 | #1 Race condition (perda de dados), #9 XSS, #2 Reset input |
| 🟡 **MÉDIO** | 6 | #3 Escape, #5 unsavedChanges, #6 Link unidirecional, #7 HTML na busca, #13 Cache, #14 Duplicação |
| 🟢 **BAIXO** | 6 | #4 Performance canvas, #8 undefined title, #10 URL validation, #11 RLS OK, #12 Debounce OK, #15 Mime OK |

---

## 🎯 RECOMENDAÇÕES PRIORITÁRIAS

### **IMEDIATO (Antes de deploy):**
1. ✅ Adicionar `e.target.value = ''` nos inputs de arquivo (`RichTextEditor.tsx`)
2. ✅ Implementar sanitização XSS (DOMPurify) no salvamento/exibição
3. ⚠️ Melhorar tratamento de erro na mutação tripla (rollback manual ou ordem de operações)

### **PRÓXIMA SPRINT:**
4. Extrair texto puro do HTML para busca no grafo
5. Criar hook `useExtractToNote` para eliminar duplicação
6. Pré-calcular busca do grafo fora do canvas object
7. Verificar cache invalidation do LinkPanel

### **REFINAMENTO:**
8. Validação de URL pública
9. Título fallback "Sem título"
10. Documentar semântica do link (unidirecional)

---

## ✅ CHECKLIST DE CORREÇÃO

- [ ] Input file reset após upload
- [ ] Sanitização HTML (DOMPurify)
- [ ] Ordem segura na mutação tripla (limpar por último)
- [ ] Extrair texto puro para busca no grafo
- [ ] Hook useExtractToNote
- [ ] Cache invalidation específica do LinkPanel
- [ ] Performance: pré-calcular busca do grafo
