# 🚀 Análise de Performance e Qualidade - GraphNexus

**Data:** 15/04/2026  
**Analisado por:** Cascade Code Review  

---

## 📊 PERFORMANCE

### ✅ PONTOS POSITIVOS

| Aspecto | Status | Detalhes |
|---------|--------|----------|
| **Lazy Loading** | ✅ OK | `ForceGraph2D` em `Graph.tsx` usa `React.lazy()` |
| **Debounce Search** | ✅ OK | `Notes.tsx` usa `useDebouncedValue` (300ms) |
| **CommandPalette** | ✅ OK | Usa `useDebouncedValue` |
| **LinkPicker** | ✅ OK | Usa `useDebouncedValue` |
| **useMemo/useCallback** | ✅ Parcial | Usado em `Graph.tsx` e páginas de detalhe |

---

### 🟡 PROBLEMAS DE PERFORMANCE ENCONTRADOS

#### 1. **Re-render Desnecessário em Arrays de Opções** (Leve)

**Arquivos:** `TaskDetail.tsx`, `ProjectDetail.tsx`, `Notes.tsx`

```tsx
// ❌ Criado a cada render
const STATUS_OPTIONS = [...]; // Array literal no componente
const PRIORITY_OPTIONS = [...]; // Array literal no componente
const NOTE_COLORS = [...]; // Array literal no componente
```

**Impacto:** Arrays recriados a cada render → Selects re-renderizam desnecessariamente.

**Solução:**
```tsx
// ✅ Movendo para fora do componente ou usar useMemo
const STATUS_OPTIONS = useMemo(() => [
  { value: "backlog", label: "Backlog" },
  // ...
], []);
```

---

#### 2. **Funções Inline em Event Handlers** (Médio)

**Arquivo:** `TaskDetail.tsx` (linhas 258, 267, etc)

```tsx
// ❌ Nova função criada a cada render
<Input
  onChange={(e) => { setTitle(e.target.value); markChanged(); }}
/>
<Select
  onValueChange={(v) => { setStatus(v as TaskStatus); markChanged(); }}
>
```

**Impacto:** Cada render cria novas referências de função → triggers re-render em componentes filhos.

**Solução:**
```tsx
// ✅ Usar useCallback
const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setTitle(e.target.value);
  markChanged();
}, [markChanged]);

<Input onChange={handleTitleChange} />
```

---

#### 3. **Função fetchDashboardData sem Memoização** (Baixo)

**Arquivo:** `Dashboard.tsx` (linhas 32-65)

```tsx
// ❌ Recriada a cada render da Dashboard
async function fetchDashboardData() {
  const today = format(new Date(), "yyyy-MM-dd");
  // ... muitas queries
}
```

**Impacto:** Função recriada → React Query re-executa se referência mudar (embora queryKey seja estável).

**Solução:**
```tsx
// ✅ Definir fora do componente ou usar useCallback
const fetchDashboardData = useCallback(async () => {
  // ...
}, []);
```

---

#### 4. **String Concatenação em Loop (Graph Canvas)** (Alto)

**Arquivo:** `Graph.tsx` (linhas 147-151)

```tsx
const nodeMatchesSearch = useCallback((node: GraphNode): boolean => {
  const searchableText = [
    node.label,
    node.content,
    node.description,
  ].filter(Boolean).join(" ").toLowerCase(); // ❌ Executado 60fps!
  return searchableText.includes(term);
}, [graphSearch]);
```

**Impacto:** String concatenation + `toLowerCase()` em loop de canvas = baixa performance com muitos nós.

**Solução:**
```tsx
// ✅ Pré-calcular textos dos nós
const searchIndex = useMemo(() => {
  const index = new Map<string, string>();
  data?.nodes.forEach(node => {
    index.set(node.id, [
      node.label,
      node.content,
      node.description
    ].filter(Boolean).join(" ").toLowerCase());
  });
  return index;
}, [data]);

const nodeMatchesSearch = useCallback((node: GraphNode) => {
  return searchIndex.get(node.id)?.includes(term) ?? false;
}, [searchIndex, term]);
```

---

#### 5. **Promise.all sem tratamento individual** (Médio)

**Arquivo:** `Dashboard.tsx` (linhas 44-52)

```tsx
const [
  notesCount,
  tasksCount,
  // ...
] = await Promise.all([
  supabase.from("notes").select(...),
  supabase.from("tasks").select(...),
  // ...
]);
```

**Impacto:** Se uma query falhar, todas falham. Dashboard fica em loading eterno.

**Solução:**
```tsx
const results = await Promise.allSettled([
  supabase.from("notes").select(...),
  supabase.from("tasks").select(...),
]);

const notesCount = results[0].status === 'fulfilled' ? results[0].value : { count: 0 };
```

---

### 🖼️ IMAGENS

#### 6. **Placeholder.svg sem Lazy Loading** (Baixo)

**Arquivo:** `Index.tsx` (linha 9)

```tsx
<img data-lovable-blank-page-placeholder="REMOVE_THIS" src="/placeholder.svg" />
```

**Problema:** Sem `loading="lazy"` (embora seja uma página temporária).

**Solução:**
```tsx
<img loading="lazy" src="/placeholder.svg" alt="..." />
```

#### 7. **Avatar sem dimensões explícitas** (Leve)

**Arquivo:** `avatar.tsx`

```tsx
<AvatarPrimitive.Image className={cn("aspect-square h-full w-full", className)} />
```

O componente usa `h-full w-full` que depende do pai ter dimensões definidas. OK, mas poderia ter dimensões default.

---

## 📝 QUALIDADE DE CÓDIGO

### 🔴 PROBLEMAS CRÍTICOS

#### 8. **Duplicação Massiva: TaskDetail vs ProjectDetail** (Alto)

**Arquivos:**
- `TaskDetail.tsx` (432 linhas)
- `ProjectDetail.tsx` (376 linhas)

**Duplicação identificada:**
- ~80% da estrutura é idêntica (estados, mutations, useEffect, handlers)
- Lógica de extração de nota **100% duplicada**
- Padrão de "markChanged" + "saveMutation" + "deleteMutation"
- Estrutura de formulário (Label + Input + onChange)
- AlertDialogs (delete, unsaved changes, extract)

**Impacto:** Manutenção difícil, bugs podem ser corrigidos em um lugar e esquecidos no outro.

**Solução - Hook genérico `useEntityDetail`:**

```tsx
// hooks/useEntityDetail.ts
interface UseEntityDetailOptions<T> {
  id: string;
  fetchFn: (id: string) => Promise<T>;
  updateFn: (id: string, data: Partial<T>) => Promise<T>;
  deleteFn: (id: string) => Promise<void>;
  queryKey: string;
  navigateTo: string;
}

export function useEntityDetail<T extends { id: string; title: string }>(
  options: UseEntityDetailOptions<T>
) {
  const { id, fetchFn, updateFn, deleteFn, queryKey, navigateTo } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: [queryKey, id],
    queryFn: () => fetchFn(id),
    enabled: !!id,
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  
  // ... lógica comum de formulário, mutations, extract, etc
  
  return {
    data,
    isLoading,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    saveMutation,
    deleteMutation,
    extractMutation,
    // ...
  };
}
```

**Redução estimada:** ~250 linhas em cada arquivo → ~100 linhas cada (60% de economia).

---

#### 9. **Componente WeeklyReview Gigante** (Médio)

**Arquivo:** `WeeklyReview.tsx` (384 linhas)

Contém 4 componentes internos:
- `StepDump` (linha 93)
- `StepOverdue` (linha 171)
- `StepOrphanNotes` (linha 271)
- `StepDone` (linha 367)

**Impacto:** Difícil de testar, manter e entender. Cada step deveria ser um componente separado.

**Solução:**
```
src/components/WeeklyReview/
├── index.tsx (container principal)
├── steps/
│   ├── StepDump.tsx
│   ├── StepOverdue.tsx
│   ├── StepOrphanNotes.tsx
│   └── StepDone.tsx
└── hooks/
    └── useWeeklyReview.ts
```

---

#### 10. **Dashboard.tsx - Muitas Responsabilidades** (Médio)

**Arquivo:** `Dashboard.tsx` (330 linhas)

- Lógica de greeting
- Lógica de review day
- Fetch de múltiplas entidades
- Renderização complexa de cards
- Lógica de swipe/posponement

**Solução:** Extrair componentes:
- `DashboardHeader` (greeting + review banner)
- `StatsCards` (counts)
- `DueTasksList`
- `RecentNotesList`
- `ActivityFeed`

---

### 🟡 PROBLEMAS MÉDIOS

#### 11. **Lógica de Extract Duplicada** (Médio)

**Arquivos:** `TaskDetail.tsx` (linhas 143-181) e `ProjectDetail.tsx` (linhas 127-165)

Código praticamente idêntico para extrair descrição como nota.

**Solução:** Hook `useExtractToNote` (já sugerido no relatório anterior).

---

#### 12. **Funções Inline em JSX** (Médio)

**Padrão encontrado em múltiplos arquivos:**

```tsx
// TaskDetail.tsx, ProjectDetail.tsx, Notes.tsx
<Button onClick={() => archiveMutation.mutate(note.id)} />
<Button onClick={() => setSelectedTags([...])} />
<Input onChange={(e) => { setTitle(e.target.value); markChanged(); }} />
```

**Impacto:** Cada render cria nova função → filhos re-renderizam.

**Solução:**
```tsx
const handleArchive = useCallback((id: string) => {
  archiveMutation.mutate(id);
}, [archiveMutation]);

<Button onClick={() => handleArchive(note.id)} />
```

---

#### 13. **Strings Mágicas** (Baixo)

**Arquivos:** Vários

```tsx
// Em múltiplos lugares
queryKey: ["tasks"]
queryKey: ["notes"]
queryKey: ["links"]
```

**Solução:** Constantes centralizadas

```tsx
// lib/queryKeys.ts
export const QUERY_KEYS = {
  TASKS: "tasks",
  TASK: (id: string) => ["task", id],
  NOTES: "notes",
  // ...
} as const;
```

---

### 🟢 PROBLEMAS LEVES

#### 14. **Importação Duplicada** (Leve)

**Arquivo:** `Dashboard.tsx` (linhas 4 e 20)

```tsx
import { Clock } from "lucide-react";  // linha 4
import { Clock as ClockIcon } from "lucide-react";  // linha 20 - DESNECESSÁRIO
```

**Solução:** Usar apenas um import.

---

## 🔍 COMENTÁRIOS E DEBUG

### ✅ Limpo
- ✅ Nenhum `console.log()` esquecido
- ✅ `console.error` apenas em tratamento de erros (Graph.tsx, storage.ts, NotFound.tsx)

### 🟡 Comentários de Debug

**Arquivo:** `storage.ts`

```tsx
console.error("Erro no upload:", uploadError);
console.error("Erro inesperado no upload:", error);
```

**Avaliação:** Aceitável para debugging de upload, mas poderia usar toast ou logger.

---

## 📋 TODOs E FIXMEs

### ✅ Nenhum encontrado

Busca por `TODO` e `FIXME` não retornou resultados. Código está limpo de tarefas pendentes.

---

## 📊 MÉTRICAS DE QUALIDADE

### Tamanho de Arquivos

| Arquivo | Linhas | Status |
|---------|--------|--------|
| `TaskDetail.tsx` | 432 | 🔴 Grande |
| `ProjectDetail.tsx` | 376 | 🟡 Grande |
| `Dashboard.tsx` | 330 | 🟡 Grande |
| `WeeklyReview.tsx` | 384 | 🟡 Grande |
| `Notes.tsx` | 322 | 🟡 Grande |
| `Graph.tsx` | 267 | 🟢 OK |
| `RichTextEditor.tsx` | 370 | 🟡 Grande |

**Recomendação:** Componentes >300 linhas devem ser quebrados.

### Linhas de Código por Categoria

| Categoria | Arquivos | Total Linhas | Média |
|-----------|----------|--------------|-------|
| Pages | 12 | ~2,100 | 175 |
| Components | 46 | ~3,500 | 76 |
| Hooks | 3 | ~300 | 100 |
| API | 5 | ~400 | 80 |
| Utils | 3 | ~150 | 50 |

---

## 🎯 PRIORIDADES DE REFATORAÇÃO

### 🔴 CRÍTICO (Fazer na próxima sprint)

1. **Criar hook `useEntityDetail`** - Eliminar duplicação TaskDetail/ProjectDetail
2. **Refatorar WeeklyReview** - Separar em componentes menores
3. **Otimizar Graph canvas** - Pré-calcular texto de busca

### 🟡 MÉDIO (Quando possível)

4. **Extrair funções de handlers** - useCallback em eventos
5. **Mover constantes para fora de componentes**
6. **Criar constantes para query keys**
7. **Quebrar Dashboard em sub-componentes**

### 🟢 BAIXO (Nice to have)

8. **Remover import duplicado do Dashboard**
9. **Adicionar lazy loading às imagens**
10. **Documentar hooks customizados**

---

## 💡 SUGESTÕES ARQUITETURAIS

### Estrutura de Hooks Recomendada

```
src/hooks/
├── entities/
│   ├── useEntityDetail.ts (genérico)
│   ├── useTaskDetail.ts
│   ├── useProjectDetail.ts
│   └── useNoteDetail.ts
├── mutations/
│   ├── useExtractToNote.ts
│   └── useArchiveEntity.ts
└── queries/
    ├── useDashboard.ts
    └── useGraphData.ts
```

### Componentização Sugerida

```
src/components/
├── EntityDetail/
│   ├── Form.tsx
│   ├── Header.tsx
│   ├── DescriptionField.tsx
│   └── Actions.tsx
├── WeeklyReview/
│   └── steps/
└── Dashboard/
    ├── StatsCards.tsx
    ├── DueTasks.tsx
    ├── RecentNotes.tsx
    └── ActivityFeed.tsx
```

---

## 📈 IMPACTO ESTIMADO DAS REFATORAÇÕES

| Refatoração | Linhas Economizadas | Manutenção | Performance |
|-------------|---------------------|------------|-------------|
| useEntityDetail | ~400 linhas | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| WeeklyReview split | ~100 linhas | ⭐⭐⭐⭐ | ⭐⭐ |
| Graph optimization | ~50 linhas | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| useCallback handlers | ~80 linhas | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Total** | **~630 linhas** | **+40%** | **+25%** |

---

## ✅ CHECKLIST DE MELHORIAS

- [ ] Criar `useEntityDetail` hook
- [ ] Refatorar `TaskDetail` para usar hook
- [ ] Refatorar `ProjectDetail` para usar hook  
- [ ] Separar `WeeklyReview` em steps/
- [ ] Otimizar busca no Graph com índice
- [ ] Extrair handlers com useCallback
- [ ] Mover arrays de opções para fora de componentes
- [ ] Criar constantes para query keys
- [ ] Separar Dashboard em sub-componentes
- [ ] Adicionar lazy loading às imagens
