# Debug Session: Publicar Vídeo Flow
- Status: [OPEN]
- Session ID: `video-publish-flow`
- Bug report: "Não está funcionando. Ao clicar em publicar vídeo, não volta pra tela inicial, não reseta formulário, não renderiza cards na tela inicial."
- Iniciado em: 2026-09-22

---

## Hipóteses Falsificáveis

| ID | Hipótese | Ponto de Observação |
|----|----------|----------------------|
| H1 | `publicarVideo()` está sendo abortada ANTES do fim por alguma referência nula em `document.getElementById(...)` | Chamadas com `?.value` / `?.textContent` / `?.addEventListener` |
| H2 | `voltarSelecao()` é undefined ou não existe, causando erro que para a execução no final do publicarVideo | Verificação de existência de `voltarSelecao` |
| H3 | `resetarFormularioVideo()` chama algo que causa erro (ex: `.load()` em `<video>` vazio ou `URL.revokeObjectURL` em string não-URL) | Rastreamento em cada step do reset |
| H4 | `carregarCardsRetangularesNaTelaInicial()` é chamada ANTES do HTML da tela inicial estar visível, ou há bug no `renderizarCardRetangular` (ex: item sem `criadoEm` causando NaN no sort) | Verificação de dados no storage + sort + render |
| H5 | Preview do celular não é removido corretamente, causando erro que para o reset ou publish | Função `atualizarPreviewVideo` ou atributos de video/capa img |

---

## Instrumentação
- Adicionar points de instrumentação em cada milestone do flow:
  1. Início de `publicarVideo()`
  2. Após validações
  3. Após salvar no storage
  4. Antes de chamar reset
  5. Antes de voltar selecao
  6. Entradas do resetFormularioVideo (passo 1 ao 9)
  7. Entrada e saída do carregarCardsRetangulares + cada renderizacao
- Coletar via instrumentação em `console` temporário (vamos verificar depois)

---

## Evidência
| ID | Status | Log / Evidência |
|----|--------|------------------|
| H1 | — | — |
| H2 | — | — |
| H3 | — | — |
| H4 | — | — |
| H5 | — | — |

---

## Fix aplicada
- [x] Refatoração do preview do celular (substituído por versão mais simples)
- [x] Simplificação do reset
- [ ] —

## Verificação pós-fix
- [ ] Confirmado pelo usuário
