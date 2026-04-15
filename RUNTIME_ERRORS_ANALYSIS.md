# 🚨 Análise de Erros em Tempo de Execução - GraphNexus

**Data:** 15/04/2026  
**Analisado por:** Cascade Code Review  
**Total de Problemas Encontrados:** 17

---

## 1. Chamadas a .map(), .filter(), .find() em Variáveis Potencialmente Null/Undefined

### ❌ PROBLEMA 1: `tasks.find()` antes de verificar isLoading
**Arquivo:** `Tasks.tsx` (linhas 206-207, 217)

```tsx
const handleDragStart = (event: DragStartEvent) => {
  setActiveTask(tasks.find((t) => t.id === event.active.id) || null);
};

const handleDragEnd = (event: DragEndEvent) => {
  // ...
  const task = tasks.find((t) => t.id === taskId);
```

**Risco:** Se o drag iniciar antes do carregamento completar, `tasks` pode ser `undefined`.

**Correção:**
```tsx
const handleDragStart = (event: DragStartEvent) => {
  if (!tasks) return;
  setActiveTask(tasks.find((t) => t.id === event.active.id) || null);
};
```

---

### ❌ PROBLEMA 2: `notes.map()` sem verificação de null em `NoteCard`
**Arquivo:** `Notes.tsx` (linhas 188-195)

```tsx
{note.tags && note.tags.length > 0 && (
  <div className="mt-3 flex flex-wrap gap-1">
    {note.tags.map((t) => (  // ❌ note.tags pode ser null
      <Badge key={t} variant="secondary" className="text-xs">
        {t}
      </Badge>
    ))}
  </div>
)}
```

**Análise:** A verificação `note.tags &&` existe, mas se `note.tags` for `null`, o JS nem entra no bloco. **Está OK**, mas poderia usar optional chaining para segurança extra.

**Correção recomendada:**
```tsx
{note.tags?.map((t) => (...))}
```

---

### ❌ PROBLEMA 3: `allTags.map()` sem verificar se é array
**Arquivo:** `Notes.tsx` (linhas 277-289)

```tsx
{allTags.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {allTags.map((tag) => (...))}
  </div>
)}
```

**Risco:** Se `getAllNoteTags()` retornar `null` em vez de `[]`, `allTags.length` quebra.

**Correção:**
```tsx
{allTags?.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {allTags?.map((tag) => (...))}
  </div>
)}
```

---

### ❌ PROBLEMA 4: `data.activityFeed.map()` sem verificar data
**Arquivo:** `Dashboard.tsx` (linha 305)

```tsx
{data.activityFeed.map((item) => (...))}
```

**Risco:** Embora haja `if (!data) return null` na linha 102, se a estrutura mudar ou `activityFeed` for `undefined`, quebra.

**Correção:**
```tsx
{data?.activityFeed?.map((item) => (...))}
```

---

### ❌ PROBLEMA 5: `linkedEntities.map()` e dependências de query
**Arquivo:** `LinkPanel.tsx` (linhas 117-123)

```tsx
const linkedEntities = links.map((link) => getLinkedEntity(link, entityId));
const { data: titleMap = {} } = useQuery({
  queryKey: ["entity-titles", linkedEntities.map((e) => e.id).sort().join(",")],
  // ...
});
```

**Risco:** Se `links` for `undefined` antes de carregar, quebra.

**Correção:**
```tsx
const linkedEntities = links?.map((link) => getLinkedEntity(link, entityId)) ?? [];
```

---

## 2. Uso de Dados de Queries Antes de Verificar isLoading

### ❌ PROBLEMA 6: `task.title` em extração sem verificar loading
**Arquivo:** `TaskDetail.tsx` (linha 150)

```tsx
title: `Ref: ${task.title}`,
```

**Risco:** A mutação `extractMutation` acessa `task.title` sem garantir que `task` existe. A verificação `if (!description || !id || !task)` existe, mas `task` pode ficar `undefined` temporariamente.

**Correção:**
```tsx
title: `Ref: ${task?.title || 'Sem título'}`,
```

---

### ❌ PROBLEMA 7: Acesso a `notes.data`, `projects.data` sem optional chaining
**Arquivo:** `Archive.tsx` (linhas 178-180)

```tsx
<TabsContent value="notes">{renderList(notes.data, notes.isLoading, "notes")}</TabsContent>
<TabsContent value="projects">{renderList(projects.data, projects.isLoading, "projects")}</TabsContent>
<TabsContent value="tasks">{renderList(tasks.data, tasks.isLoading, "tasks")}</TabsContent>
```

**Risco:** Se `notes` ainda não foi inicializado (caso extremo), `notes.data` quebra.

**Correção:**
```tsx
<TabsContent value="notes">{renderList(notes?.data, notes?.isLoading, "notes")}</TabsContent>
```

---

## 3. useEffect com Dependências Faltando ou Incorretas

### ❌ PROBLEMA 8: Dependências faltando no useEffect do debounce
**Arquivo:** `RichTextEditor.tsx` (linhas 99-102)

```tsx
useEffect(() => {
  const timer = setTimeout(() => doSearch(search), 250);
  return () => clearTimeout(timer);
}, [search, doSearch]);
```

**Análise:** Tecnicamente está correto, mas `doSearch` é uma função `useCallback` sem dependências (linha 80). Se `doSearch` capturar algum valor que muda, pode ter problema.

**Verificação de `doSearch`:**
```tsx
const doSearch = useCallback(async (q: string) => {
  // usa apenas parâmetro q, não usa closures externos
}, []); // ✅ Sem dependências, está OK
```

**Status:** ✅ Está OK, mas recomendo revisar se adicionar lógica nova.

---

### ❌ PROBLEMA 9: Dependência de array/objeto que muda referência
**Arquivo:** `Notes.tsx` (linhas 210-213)

```tsx
const { data: notes = [], isLoading } = useQuery({
  queryKey: ["notes", debouncedSearch, selectedTags, showArchived],
  queryFn: () => fetchNotes({ search: escapeLikePattern(debouncedSearch), tags: selectedTags, showArchived }),
});
```

**Análise:** `selectedTags` é um array. Se a referência mudar a cada render, invalida o cache. Verificar se `selectedTags` é estável.

**Correção recomendada:** Garantir que `selectedTags` seja estável ou usar JSON.stringify na queryKey:
```tsx
queryKey: ["notes", debouncedSearch, JSON.stringify(selectedTags), showArchived],
```

---

## 4. Estados sendo Atualizados em Componentes Desmontados (Memory Leaks)

### ❌ PROBLEMA 10: setState após operação async sem cleanup
**Arquivo:** `Signup.tsx` (linhas 15-27)

```tsx
const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  const { error } = await supabase.auth.signUp({...});
  setLoading(false); // ❌ Se componente desmontou, warning no console
  if (error) {
    toast.error(error.message);
  } else {
    toast.success("Verifique seu email!");
    navigate("/login"); // ❌ Navega, desmonta componente
  }
};
```

**Risco:** Se o usuário navegar para outra página antes da Promise resolver, `setLoading(false)` é chamado em componente desmontado.

**Correção:**
```tsx
const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  
  try {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Verifique seu email!");
      navigate("/login");
      // Não chamar setLoading(false) após navegação
    }
  } catch {
    setLoading(false);
  }
};
```

---

### ❌ PROBLEMA 11: setState em callbacks de mutation após navegação
**Arquivo:** `NewTaskDialog` em `Tasks.tsx` (linhas 110-119)

```tsx
const mutation = useMutation({
  mutationFn: createTask,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Tarefa criada!");
    setOpen(false);      // ✅ Antes da navegação
    setTitle("");          // ✅ Antes da navegação
  },
  onError: () => toast.error("Erro ao criar tarefa"),
});
```

**Análise:** O dialog fecha (`setOpen(false)`), mas o componente ainda existe. Está relativamente seguro, mas se o usuário navegar rapidamente após criar, pode haver warning.

**Recomendação:** Não crítico, mas pode usar flag de mounted:
```tsx
const isMounted = useRef(true);
useEffect(() => () => { isMounted.current = false; }, []);

onSuccess: () => {
  if (!isMounted.current) return;
  // ... setStates
}
```

---

## 5. Promises sem .catch() ou Blocos try/catch

### ❌ PROBLEMA 12: `Promise.all` sem try/catch em `fetchEntityTitles`
**Arquivo:** `LinkPanel.tsx` (linhas 50-60)

```tsx
const [notes, tasks, projects] = await Promise.all([
  noteIds.length > 0
    ? supabase.from("notes").select("id, title").in("id", noteIds)
    : Promise.resolve({ data: [] }),
  // ...
]);
```

**Risco:** Se alguma query falhar, o erro propaga para quem chamou `useQuery`, que tem tratamento. ✅ **Está OK** porque está dentro de `useQuery` com `queryFn`.

---

### ❌ PROBLEMA 13: `fetchDashboardData` sem tratamento de erro individual
**Arquivo:** `Dashboard.tsx` (linhas 44-52)

```tsx
const [
  notesCount,
  tasksCount,
  // ...
] = await Promise.all([
  supabase.from("notes").select("id", { count: "exact", head: true }).eq("archived", false),
  // ...
]);
```

**Risco:** Se uma query falhar, todas falham. Não há `.catch()` em cada uma.

**Correção:**
```tsx
const notesCount = await supabase.from("notes").select(...)
  .then(r => r).catch(() => ({ count: 0, data: [] }));
// ... ou usar Promise.allSettled
```

---

### ❌ PROBLEMA 14: `fetchGraphData` sem tratamento de erro
**Arquivo:** `Graph.tsx` (linhas 44-78)

```tsx
async function fetchGraphData() {
  const [notes, tasks, projects, links] = await Promise.all([
    supabase.from("notes").select("..."),
    // ...
  ]);
  // ...
}
```

**Risco:** Se qualquer query falhar, o grafo não carrega. Não há tratamento de erro.

**Correção:**
```tsx
async function fetchGraphData() {
  try {
    const [notes, tasks, projects, links] = await Promise.all([
      supabase.from("notes").select("..."),
      // ...
    ]);
    // ...
  } catch (error) {
    console.error("Erro ao carregar grafo:", error);
    return { nodes: [], links: [] };
  }
}
```

---

## 6. Funções Assíncronas em useEffect sem Cleanup

### ❌ PROBLEMA 15: useEffect em `RichTextEditor` sem cleanup de async
**Arquivo:** `RichTextEditor.tsx` (linhas 99-102)

```tsx
useEffect(() => {
  const timer = setTimeout(() => doSearch(search), 250);
  return () => clearTimeout(timer);
}, [search, doSearch]);
```

**Análise:** O `doSearch` é async. Se o componente desmontar enquanto a busca está em andamento, a função tentará chamar `setResults` em componente desmontado.

**Correção:**
```tsx
useEffect(() => {
  let cancelled = false;
  const timer = setTimeout(async () => {
    const results = await doSearch(search);
    if (!cancelled) {
      // setResults aqui
    }
  }, 250);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [search, doSearch]);
```

---

## 7. Variáveis de Ambiente sem Verificação

### ❌ PROBLEMA 16: `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` sem validação
**Arquivo:** `supabase/client.ts` (linhas 5-11)

```tsx
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
```

**Risco:** Se as variáveis de ambiente não estiverem definidas, o app quebra com erro críptico.

**Correção:**
```tsx
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias"
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
```

---

### ❌ PROBLEMA 17: DOMParser pode lançar exceção
**Arquivo:** `Notes.tsx` (linhas 181-184)

```tsx
{(() => {
  const doc = new DOMParser().parseFromString(note.content, "text/html");
  return (doc.body.textContent || "").slice(0, 200);
})()}
```

**Risco:** Se `note.content` for HTML malformado ou muito grande, pode lançar exceção.

**Correção:**
```tsx
{(() => {
  try {
    const doc = new DOMParser().parseFromString(note.content || "", "text/html");
    return (doc.body?.textContent || "").slice(0, 200);
  } catch {
    return "";
  }
})()}
```

---

## 📊 Resumo por Categoria

| Categoria | Quantidade | Severidade |
|-----------|-----------|------------|
| `.map()` em potencial null | 5 | 🟡 Média |
| Dados antes de isLoading | 2 | 🔴 Alta |
| useEffect dependências | 2 | 🟡 Média |
| Memory leaks (setState em desmontado) | 2 | 🟡 Média |
| Promises sem tratamento | 3 | 🟡 Média |
| Async em useEffect sem cleanup | 1 | 🟡 Média |
| Variáveis de ambiente | 1 | 🔴 Alta |
| DOMParser sem try/catch | 1 | 🟢 Baixa |

---

## 🎯 Checklist de Correção

### Prioridade 1 (Alta - Corrigir Agora):
- [ ] `supabase/client.ts` - Validar env vars (PROBLEMA 16)
- [ ] `TaskDetail.tsx` - Optional chaining em `task?.title` (PROBLEMA 6)
- [ ] `Archive.tsx` - Optional chaining em `notes?.data` (PROBLEMA 7)

### Prioridade 2 (Média - Corrigir na Sprint):
- [ ] `Signup.tsx` - Memory leak após navegação (PROBLEMA 10)
- [ ] `Dashboard.tsx` - Promise.allSettled para queries (PROBLEMA 13)
- [ ] `Graph.tsx` - try/catch em fetchGraphData (PROBLEMA 14)
- [ ] `RichTextEditor.tsx` - Cancelamento de async (PROBLEMA 15)

### Prioridade 3 (Baixa - Refinamento):
- [ ] `Notes.tsx` - Optional chaining em `allTags?.map` (PROBLEMA 3)
- [ ] `Notes.tsx` - try/catch no DOMParser (PROBLEMA 17)
- [ ] `Notes.tsx` - JSON.stringify na queryKey (PROBLEMA 9)
- [ ] `Tasks.tsx` - Verificação `tasks?.find` (PROBLEMA 1)

---

## 💡 Recomendação Geral

Criar um hook `useIsMounted()` reutilizável:

```tsx
// hooks/useIsMounted.ts
import { useRef, useEffect } from 'react';

export function useIsMounted() {
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);
  return () => isMounted.current;
}

// Uso:
const isMounted = useIsMounted();

onSuccess: () => {
  if (!isMounted()) return;
  setState(...);
}
```
