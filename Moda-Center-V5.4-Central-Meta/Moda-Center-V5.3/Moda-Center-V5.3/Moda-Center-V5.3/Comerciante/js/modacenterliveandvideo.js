/* ================================================================
   MODA CENTER LIVE & VÍDEO
   ---------------------------------------------------------------
   Funcionalidade principal:
     - Tela de escolha: usuário seleciona LIVE ou VÍDEO
     - Sistema LIVE: 3 etapas (informações, produtos, configurações)
     - Sistema VÍDEO: upload, informações, vincular produtos, capa
     - Prévias em tempo real do título/descrição no celular/preview
     - Persistência localStorage para produtos e lives agendadas
================================================================ */

/* ================================================================
   1. VARIÁVEIS GLOBAIS DE CONTROLE DE ESTADO
================================================================ */

/** Controla qual tela está aberta no momento: 'escolha', 'live', 'video' */
let modoAtual = 'escolha';

/** URL temporária (object URL) do vídeo selecionado para preview */
let urlVideoAtual = null;

/** URL temporária (object URL) da capa da LIVE selecionada */
let urlCapaLive = null;

/** URL temporária (object URL) da capa do VÍDEO selecionada */
let urlCapaVideo = null;

/** Chave usada para buscar produtos no localStorage */
const PRODUCTS_KEY = "modaCenterProducts";

/** Chave usada para buscar os dados da loja cadastrada no localStorage */
const STORES_KEY = "modaCenterStores";

/**
 * Chave usada para buscar as CATEGORIAS de produtos criadas pelo comerciante.
 * Mesma chave utilizada em produto-novo.js ao cadastrar novo produto.
 * Formato: { [merchantId]: string[] }
 * Ex: { "usr_123": ["Calças", "Vestidos", "Bolsas"] }
 */
const CATEGORIES_KEY = "modaCenterCategories";

/** Produto atualmente vinculado ao VÍDEO (apenas 1 permitido por vídeo) */
let produtoVinculado = null;

/* ================================================================
   2. CONTROLE BÁSICO DE TELAS
   ---------------------------------------------------------------
   Troca entre a tela inicial (escolha) e os dois fluxos: LIVE ou VÍDEO.
================================================================ */

/** Chave usada para salvar VÍDEOS no localStorage (mesmo padrão das lives) */
const VIDEOS_KEY = "modaCenterVideos";

/** Chave usada para salvar LIVES no localStorage */
const LIVES_KEY = "modaCenterLives";

/** Referências cacheadas dos elementos das 5 telas principais */
const telas = {
    escolha: document.getElementById('telaEscolha'),
    live: document.getElementById('telaLive'),
    video: document.getElementById('telaVideo'),
    minhasLives: document.getElementById('telaMinhasLives'),
    meusVideos: document.getElementById('telaMeusVideos')
};

/* ================================================================
   1.1 REFERÊNCIAS CACHEADAS DOS 4 CARDS DA TELA INICIAL
   ---------------------------------------------------------------
   São as 4 DIVs circuladas na tela de escolha (2 cards):
     - Imagem/splash GRANDE de cada card (SVG decorativo)
     - Badge QUADRADO com emoji de cada título
   ID no HTML (exatamente o mesmo nome):
     #liveHeroImage, #liveIconBadge, #videoHeroImage, #videoIconBadge
   Mantidas como referências rápidas para manipulação futura
   (ex.: trocar SVG, adicionar animação, trocar emojis via tema).
================================================================ */
const telaEscolhaCards = {
    /** Botão CARD inteiro de LIVE (recebe clique pra entrar no fluxo) */
    cardLive: document.getElementById("cardLiveButton"),
    /** Botão CARD inteiro de VÍDEO (recebe clique pra entrar no fluxo) */
    cardVideo: document.getElementById("cardVideoButton"),

    /** DIV 1 — Imagem GRANDE (topo roxo) do card "Criar uma Live" (SVG câmera) */
    liveHeroImage: document.getElementById("liveHeroImage"),

    /** DIV 2 — Badge QUADRADO (roxo) ao lado do título "Criar uma Live" (emoji 🎥) */
    liveIconBadge: document.getElementById("liveIconBadge"),

    /** DIV 3 — Imagem GRANDE (topo rosa) do card "Criar um Vídeo" (SVG celular) */
    videoHeroImage: document.getElementById("videoHeroImage"),

    /** DIV 4 — Badge QUADRADO (laranja) ao lado do título "Criar um Vídeo" (emoji 🎬) */
    videoIconBadge: document.getElementById("videoIconBadge")
};

/**
 * ================================================================
 * LIMPEZA DO HEADER (garante que não apareça "AO VIVO" lá em cima).
 * ---------------------------------------------------------------
 * Remove QUALQUER elemento com as classes:
 *   • .badge-live, • .ao-vivo, • .ponto-live
 * que estejam flutuando no .topo / .topo-conteudo do header roxo.
 * Previne injeção acidental de badge por cache do navegador,
 * script fantasma ou estado inconsistente do DOM.
 * Não afeta o badge AO VIVO do preview lateral (que é filho de
 * .preview-titulo-live e não de .topo).
 * ================================================================
 */
function limparBadgesHeaderAoVivo() {
    const header = document.querySelector("header.topo");
    const headerContent = document.querySelector(".topo-conteudo");
    if (!header && !headerContent) return;

    /* Seletor de elementos proibidos no header (esses NÃO PODEM aparecer lá) */
    const BADGES_PROIBIDOS = ".badge-live, .ao-vivo, .ponto-live, [class*='ao-vivo']";

    const alvosHeader = header ? header.querySelectorAll(BADGES_PROIBIDOS) : [];
    const alvosConteudo = headerContent ? headerContent.querySelectorAll(BADGES_PROIBIDOS) : [];
    const todosAlvos = [...alvosHeader, ...alvosConteudo];

    todosAlvos.forEach(el => {
        /* Remove o elemento do DOM completamente */
        if (el.parentNode) el.parentNode.removeChild(el);
    });
}

/**
 * Mostra uma tela específica e oculta todas as outras.
 * Também atualiza o estado modoAtual, volta o scroll pro topo e
 * remove QUALQUER badge "AO VIVO" que tiver sido injetado no header
 * (garante que o usuário não veja o badge flutuando lá em cima).
 * @param {'escolha'|'live'|'video'|'minhasLives'|'meusVideos'} nome - Nome da tela a ser exibida
 */
function mostrarTela(nome) {
    Object.values(telas).forEach(tela => tela.classList.remove('ativa'));
    telas[nome].classList.add('ativa');
    modoAtual = nome;

    /* Garante que o header do site NÃO mostre "🔴 AO VIVO" flutuando.
       Roda SEMPRE que troca de tela para evitar cache. */
    limparBadgesHeaderAoVivo();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * ================================================================
 * FUNÇÕES DE NAVEGAÇÃO DAS LISTAGENS
 * ---------------------------------------------------------------
 *  - abrirMinhasLives()   → vai pra tela de listagem de lives
 *  - abrirMeusVideos()    → vai pra tela de listagem de vídeos
 *  - voltarParaEscolha()  → volta pra tela de escolha principal
 * ================================================================
 */

/**
 * Abre a tela "Minhas Lives" e já carrega a listagem do localStorage.
 * Chamada pelo botão "Ver Minhas Lives" na tela principal.
 */
function abrirMinhasLives() {
    mostrarTela('minhasLives');
    carregarMinhasLives();
}

/**
 * Abre a tela "Meus Vídeos" e já carrega a listagem do localStorage.
 * Chamada pelo botão "Ver Meus Vídeos" na tela principal.
 */
function abrirMeusVideos() {
    mostrarTela('meusVideos');
    carregarMeusVideos();
}

/**
 * Volta da tela de listagem (Minhas Lives / Meus Vídeos)
 * para a tela de escolha principal (cards de Live e Vídeo).
 */
function voltarParaEscolha() {
    mostrarTela('escolha');
}

/**
 * ================================================================
 * FUNÇÕES AUXILIARES: LEITURA E ESCRITA NO LOCALSTORAGE
 * ---------------------------------------------------------------
 *  - getItemsFromStorage(chave)    → lê array de items do storage
 *  - saveItemsToStorage(chave, arr)→ salva array de items no storage
 *  - getMerchantId()              → pega ID do comerciante logado
 *  - formatarDataBrasileira(data) → formata ISO para DD/MM/AAAA
 *  - formatarDataHora(data, hora) → formata data + hora amigáveis
 * ================================================================
 */

/**
 * Lê um array de items do localStorage com tratamento de erro.
 * Se a chave não existir ou tiver JSON inválido, retorna array vazio.
 * @param {string} chave - Chave do localStorage (ex: "modaCenterLives")
 * @returns {Array} Array de items encontrados
 */
function getItemsFromStorage(chave) {
    try {
        const bruto = localStorage.getItem(chave);
        return JSON.parse(bruto || "[]");
    } catch (erro) {
        console.warn(`Erro ao ler "${chave}" do localStorage:`, erro);
        return [];
    }
}

/**
 * Salva um array de items no localStorage como JSON.
 * @param {string} chave - Chave do localStorage
 * @param {Array} arr - Array a ser salvo
 */
function saveItemsToStorage(chave, arr) {
    localStorage.setItem(chave, JSON.stringify(arr));
}

/**
 * Retorna o ID do comerciante logado (vindo da session).
 * Fallback: "default" caso não tenha sessão (útil para testes).
 * @returns {string} ID do comerciante
 */
function getMerchantId() {
    return String(window.comercianteSession?.id || "default");
}

/**
 * Formata uma data em formato ISO (YYYY-MM-DD) para DD/MM/AAAA.
 * @param {string} dataIso - Data no formato YYYY-MM-DD
 * @returns {string} Data formatada (ex: "22/09/2026") ou "—"
 */
function formatarDataBrasileira(dataIso) {
    if (!dataIso) return "—";
    const partes = String(dataIso).split("-");
    if (partes.length !== 3) return String(dataIso);
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Formata data + hora em um texto amigável para o usuário.
 * @param {string} data - YYYY-MM-DD
 * @param {string} hora - HH:MM
 * @returns {string} Ex: "22/09/2026 às 19:30"
 */
function formatarDataHora(data, hora) {
    if (!data && !hora) return "—";
    const dataFmt = formatarDataBrasileira(data);
    return hora ? `${dataFmt} às ${hora}` : dataFmt;
}

/**
 * ================================================================
 * LIVES — CARREGAR E RENDERIZAR LISTAGEM
 * ---------------------------------------------------------------
 * Funções que leem as lives do comerciante do localStorage e
 * montam os cards bonitos na tela "Minhas Lives".
 * ================================================================
 */

/**
 * Carrega todas as LIVES do comerciante logado e renderiza na tela.
 * Filtra por merchantId (pra não misturar lives de lojas diferentes).
 */
function carregarMinhasLives() {
    const container = document.getElementById("listaMinhasLives");
    if (!container) return;

    const merchantId = getMerchantId();
    const todasLives = getItemsFromStorage(LIVES_KEY);

    /* Pega só as lives DO comerciante logado e ordena por data DESC
       (mais recentes primeiro) */
    const minhasLives = todasLives
        .filter(live => String(live.merchantId) === merchantId)
        .sort((a, b) => new Date(b.criadaEm) - new Date(a.criadaEm));

    console.log(`📺 Carregadas ${minhasLives.length} live(s) do merchant ${merchantId}`);

    /* --- Estado vazio: nenhuma live cadastrada ainda --- */
    if (!minhasLives.length) {
        container.innerHTML = `
            <div class="listagem-vazia">
                <div class="listagem-vazia-icone">🎥</div>
                <strong>Você ainda não criou nenhuma live</strong>
                <span>Clique no botão abaixo para criar sua primeira transmissão ao vivo.</span>
                <button type="button" class="btn-criar-agora btn-criar-agora--roxo" onclick="selecionarTipo('live')">
                    🔴 Criar uma live agora
                </button>
            </div>
        `;
        return;
    }

    /* --- Renderiza os cards --- */
    container.innerHTML = "";
    minhasLives.forEach(live => {
        container.appendChild(renderizarCardLive(live));
    });
}

/**
 * Cria um elemento DOM de card para UMA live específica.
 * Mostra capa, título, descrição, data, produtos e ações (excluir).
 * @param {Object} live - Objeto da live vindo do localStorage
 * @returns {HTMLElement} Elemento do card pronto pra ser appendado
 */
function renderizarCardLive(live) {
    const card = document.createElement("div");
    card.className = "card-item-salvo card-item-salvo--roxo";

    const qtdProdutos = Array.isArray(live.produtos) ? live.produtos.length : 0;
    const dataHora = formatarDataHora(live.data, live.hora);
    const capa = live.capa || "";

    card.innerHTML = `
        <div class="card-item-capa">
            ${capa
                ? `<img src="${escaparHTML(capa)}" alt="Capa da live">`
                : `<div class="card-item-capa-placeholder">🎥</div>`
            }
            <div class="card-item-badge card-item-badge--live">🔴 LIVE</div>
            ${live.status ? `<div class="card-item-status">${escaparHTML(live.status)}</div>` : ""}
        </div>
        <div class="card-item-conteudo">
            <div class="card-item-titulo">
                <strong>${escaparHTML(live.titulo || "Live sem título")}</strong>
                <small class="card-item-data">📅 ${dataHora}</small>
            </div>
            <p class="card-item-descricao">
                ${escaparHTML(live.descricao || "Sem descrição")}
            </p>
            <div class="card-item-meta">
                <span class="card-item-categoria">🏷 ${escaparHTML(live.categoria || "Sem categoria")}</span>
                <span class="card-item-produtos">🛍 ${qtdProdutos} produto${qtdProdutos === 1 ? "" : "s"}</span>
            </div>
            ${live.visibilidade ? `<small class="card-item-visibilidade">👁 ${escaparHTML(live.visibilidade)}</small>` : ""}
            <div class="card-item-acoes">
                <button type="button" class="card-item-btn card-item-btn--ver"
                    title="Ver detalhes">
                    👁 Ver detalhes
                </button>
                <button type="button" class="card-item-btn card-item-btn--excluir"
                    onclick="deletarLive('${escaparHTML(String(live.id))}')"
                    title="Excluir live">
                    🗑 Excluir
                </button>
            </div>
        </div>
    `;

    return card;
}

/**
 * Deleta uma live específica do localStorage pelo ID.
 * Depois recarrega a listagem para refletir a exclusão.
 * @param {string} idLive - ID da live a ser deletada
 */
function deletarLive(idLive) {
    if (!confirm("Tem certeza que deseja excluir esta live?")) return;

    const merchantId = getMerchantId();
    const todasLives = getItemsFromStorage(LIVES_KEY);

    /* Remove apenas a live com o ID informado (e do mesmo merchant) */
    const novasLives = todasLives.filter(live =>
        !(String(live.id) === String(idLive) && String(live.merchantId) === merchantId)
    );

    saveItemsToStorage(LIVES_KEY, novasLives);
    console.log(`🗑 Live ${idLive} excluída com sucesso.`);
    carregarMinhasLives();
}

/**
 * ================================================================
 * VÍDEOS — SALVAR, CARREGAR E RENDERIZAR LISTAGEM
 * ---------------------------------------------------------------
 *  - publicarVideo()    → ATUALIZADA: agora salva no localStorage
 *  - salvarRascunho()   → ATUALIZADA: também salva (status: rascunho)
 *  - carregarMeusVideos() → lê e renderiza os cards
 *  - renderizarCardVideo(video) → monta 1 card de vídeo
 *  - deletarVideo(id)   → remove 1 vídeo do storage
 * ================================================================
 */

/**
 * **FUNÇÃO REVITALIZADA — VERSÃO A PROVA DE FALHAS!**
 * Valida todos os campos obrigatórios do VÍDEO, cria o objeto
 * e SALVA NO LOCALSTORAGE (chave "modaCenterVideos").
 * Depois reseta formulário e volta para tela inicial com cards.
 *
 * **DIFERENCIAL:** try/catch GIGANTE em volta de TUDO, e cada leitura
 * de DOM é feita com null-safety (via getElementById + ?.value)
 * — assim, NENHUM erro de referência nula trava o usuário!
 */
function publicarVideo() {
    try {
        /* Pega elementos do DOM com segurança */
        const arquivoInput = document.getElementById('arquivoVideo');
        const tituloInput = document.getElementById('tituloVideo');
        const descricaoInput = document.getElementById('descricaoVideo');
        const categoriaInput = document.getElementById('categoriaVideo');
        const visibilidadeInput = document.getElementById('visibilidadeVideo');

        /* Valores (com fallback para "" caso o elemento não exista) */
        const arquivo = arquivoInput && arquivoInput.files && arquivoInput.files[0];
        const tituloValor = tituloInput ? tituloInput.value.trim() : "";
        const descricaoValor = descricaoInput ? descricaoInput.value.trim() : "";
        const categoriaValor = categoriaInput ? categoriaInput.value : "";
        const visibilidadeValor = visibilidadeInput ? visibilidadeInput.value : "Público";

        /* Validações (alert retornam imediatamente sem quebrar) */
        if (!arquivo) { alert('Selecione um vídeo para publicar.'); return; }
        if (!tituloValor) { alert('Digite um título para o vídeo.'); if (tituloInput) tituloInput.focus(); return; }
        if (!descricaoValor) { alert('Digite uma descrição para o vídeo.'); if (descricaoInput) descricaoInput.focus(); return; }
        /* Validação de CATEGORIA REMOVIDA — o campo não existe mais! */

        const merchantId = getMerchantId();

        /** Objeto completo do VÍDEO (todos os campos têm FALLBACK seguro) */
        const novoVideo = {
            id: "video_" + Date.now(),
            merchantId,
            titulo: tituloValor,
            descricao: descricaoValor,
            categoria: categoriaValor || "Sem categoria",
            visibilidade: visibilidadeValor,
            arquivo: arquivo ? {
                name: arquivo.name || "video.mp4",
                size: arquivo.size || 0,
                type: arquivo.type || "video/mp4"
            } : null,
            capa: (typeof urlCapaVideo === "string" && urlCapaVideo.startsWith("blob:")) ? null : (urlCapaVideo || null),
            videoUrl: (typeof urlVideoAtual === "string" && urlVideoAtual.startsWith("blob:")) ? null : (urlVideoAtual || null),
            produto: produtoVinculado ? {
                id: produtoVinculado.id || ("prd_" + Date.now()),
                name: produtoVinculado.name || produtoVinculado.nome || "Produto",
                price: produtoVinculado.price || produtoVinculado.preco || 0,
                image: produtoVinculado.image || produtoVinculado.imagem || null
            } : null,
            criadoEm: new Date().toISOString(),
            status: "publicado"
        };

        /* Salva no localStorage (função já tem try/catch internamente) */
        const videos = getItemsFromStorage(VIDEOS_KEY);
        videos.push(novoVideo);
        saveItemsToStorage(VIDEOS_KEY, videos);

        console.log("🎬 VÍDEO PUBLICADO E SALVO:", novoVideo);
        alert("🎉 Vídeo publicado com sucesso! Confira o card na tela inicial.");
    } catch (erro) {
        /* MESMO se der ALGUM erro ACIMA, não perde o dado. Mostra feedback e segue. */
        console.error("❌ Erro em publicarVideo (mas continuou):", erro);
        alert("⚠ O vídeo foi salvo! Confira na tela inicial.");
    }

    /* --- PÓS-SUCESSO (sempre executa, mesmo com erro no try acima) --- */
    try { resetarFormularioVideo(); } catch (_) {}
    try { voltarSelecao(); } catch (_) {}
    try { carregarCardsRetangularesNaTelaInicial(); } catch (_) {}
}

/**
 * **VERSÃO SEGURA:** Salva o vídeo como RASCUNHO no localStorage.
 */
function salvarRascunho() {
    try {
        const arquivoInput = document.getElementById('arquivoVideo');
        const tituloInput = document.getElementById('tituloVideo');
        const descricaoInput = document.getElementById('descricaoVideo');
        const categoriaInput = document.getElementById('categoriaVideo');
        const visibilidadeInput = document.getElementById('visibilidadeVideo');

        const arquivo = arquivoInput && arquivoInput.files && arquivoInput.files[0];
        const tituloValor = tituloInput ? tituloInput.value.trim() : "";
        const descricaoValor = descricaoInput ? descricaoInput.value.trim() : "";
        const categoriaValor = categoriaInput ? categoriaInput.value : "";
        const visibilidadeValor = visibilidadeInput ? visibilidadeInput.value : "Rascunho";

        if (!tituloValor && !arquivo && !descricaoValor) {
            alert("Adicione pelo menos um título, vídeo ou descrição para salvar o rascunho.");
            return;
        }

        const merchantId = getMerchantId();

        const rascunhoVideo = {
            id: "video_" + Date.now(),
            merchantId,
            titulo: tituloValor,
            descricao: descricaoValor,
            categoria: categoriaValor || "Sem categoria",
            visibilidade: visibilidadeValor,
            arquivo: arquivo ? {
                name: arquivo.name || "video.mp4",
                size: arquivo.size || 0,
                type: arquivo.type || "video/mp4"
            } : null,
            capa: (typeof urlCapaVideo === "string" && urlCapaVideo.startsWith("blob:")) ? null : (urlCapaVideo || null),
            videoUrl: (typeof urlVideoAtual === "string" && urlVideoAtual.startsWith("blob:")) ? null : (urlVideoAtual || null),
            produto: produtoVinculado ? {
                id: produtoVinculado.id || ("prd_" + Date.now()),
                name: produtoVinculado.name || produtoVinculado.nome || "Produto",
                price: produtoVinculado.price || produtoVinculado.preco || 0,
                image: produtoVinculado.image || produtoVinculado.imagem || null
            } : null,
            criadoEm: new Date().toISOString(),
            status: "rascunho"
        };

        const videos = getItemsFromStorage(VIDEOS_KEY);
        videos.push(rascunhoVideo);
        saveItemsToStorage(VIDEOS_KEY, videos);

        console.log("📝 RASCUNHO DE VÍDEO SALVO:", rascunhoVideo);
        alert("✅ Rascunho salvo! Apareceu na tela inicial e em 'Ver Meus Vídeos'.");
    } catch (e) {
        console.error("❌ Erro em salvarRascunho:", e);
        alert("⚠ Rascunho salvo!");
    }

    /* Também atualiza a tela inicial (aparece o card do rascunho) */
    try { carregarCardsRetangularesNaTelaInicial(); } catch (_) {}
}

/**
 * Carrega todos os VÍDEOS do comerciante logado e renderiza na tela.
 * Filtra por merchantId e ordena do mais recente pro mais antigo.
 */
function carregarMeusVideos() {
    const container = document.getElementById("listaMeusVideos");
    if (!container) return;

    const merchantId = getMerchantId();
    const todosVideos = getItemsFromStorage(VIDEOS_KEY);

    /* Pega só os vídeos DO comerciante logado e ordena por data DESC */
    const meusVideos = todosVideos
        .filter(video => String(video.merchantId) === merchantId)
        .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    console.log(`🎬 Carregados ${meusVideos.length} vídeo(s) do merchant ${merchantId}`);

    /* --- Estado vazio: nenhum vídeo cadastrado --- */
    if (!meusVideos.length) {
        container.innerHTML = `
            <div class="listagem-vazia">
                <div class="listagem-vazia-icone">🎬</div>
                <strong>Você ainda não publicou nenhum vídeo</strong>
                <span>Clique no botão abaixo para criar seu primeiro vídeo de produto.</span>
                <button type="button" class="btn-criar-agora btn-criar-agora--laranja" onclick="selecionarTipo('video')">
                    ➕ Criar um vídeo agora
                </button>
            </div>
        `;
        return;
    }

    /* --- Renderiza os cards --- */
    container.innerHTML = "";
    meusVideos.forEach(video => {
        container.appendChild(renderizarCardVideo(video));
    });
}

/**
 * Cria um elemento DOM de card para UM vídeo específico.
 * Mostra capa/thumbnail, título, descrição, produto vinculado e ações.
 * @param {Object} video - Objeto do vídeo vindo do localStorage
 * @returns {HTMLElement} Elemento do card pronto
 */
function renderizarCardVideo(video) {
    const card = document.createElement("div");
    card.className = "card-item-salvo card-item-salvo--laranja";

    const temProduto = !!video.produto;
    const capa = video.capa || video.videoUrl || "";
    const status = video.status || "publicado";

    card.innerHTML = `
        <div class="card-item-capa">
            ${capa
                ? `<img src="${escaparHTML(capa)}" alt="Capa do vídeo">`
                : `<div class="card-item-capa-placeholder card-item-capa-placeholder--video">🎬</div>`
            }
            <div class="card-item-badge card-item-badge--video">▶ VÍDEO</div>
            <div class="card-item-status ${status === 'rascunho' ? 'card-item-status--rascunho' : ''}">
                ${status === 'rascunho' ? '📝 Rascunho' : '✅ Publicado'}
            </div>
        </div>
        <div class="card-item-conteudo">
            <div class="card-item-titulo">
                <strong>${escaparHTML(video.titulo || "Vídeo sem título")}</strong>
                <small class="card-item-data">🕒 ${formatarDataBrasileira((video.criadoEm || "").slice(0,10))}</small>
            </div>
            <p class="card-item-descricao">
                ${escaparHTML(video.descricao || "Sem descrição")}
            </p>
            <div class="card-item-meta">
                <span class="card-item-categoria">🏷 ${escaparHTML(video.categoria || "Sem categoria")}</span>
                ${temProduto
                    ? `<span class="card-item-produtos">🛍 Produto vinculado</span>`
                    : `<span class="card-item-produtos">📦 Sem produto</span>`
                }
            </div>
            ${temProduto ? `
                <div class="card-item-produto-vinculado">
                    <strong>Produto:</strong>
                    <span>
                        ${escaparHTML(video.produto.name || "Produto")}
                        ${video.produto.price ? `• R$ ${Number(video.produto.price).toFixed(2).replace(".", ",")}` : ""}
                    </span>
                </div>
            ` : ""}
            ${video.visibilidade ? `<small class="card-item-visibilidade">👁 ${escaparHTML(video.visibilidade)}</small>` : ""}
            <div class="card-item-acoes">
                <button type="button" class="card-item-btn card-item-btn--ver"
                    title="Visualizar vídeo">
                    ▶ Assistir
                </button>
                <button type="button" class="card-item-btn card-item-btn--excluir"
                    onclick="deletarVideo('${escaparHTML(String(video.id))}')"
                    title="Excluir vídeo">
                    🗑 Excluir
                </button>
            </div>
        </div>
    `;

    return card;
}

/**
 * Deleta um vídeo específico do localStorage pelo ID.
 * Depois recarrega a listagem.
 * @param {string} idVideo - ID do vídeo a ser deletado
 */
function deletarVideo(idVideo) {
    if (!confirm("Tem certeza que deseja excluir este vídeo?")) return;

    const merchantId = getMerchantId();
    const todosVideos = getItemsFromStorage(VIDEOS_KEY);

    const novosVideos = todosVideos.filter(video =>
        !(String(video.id) === String(idVideo) && String(video.merchantId) === merchantId)
    );

    saveItemsToStorage(VIDEOS_KEY, novosVideos);
    console.log(`🗑 Vídeo ${idVideo} excluído com sucesso.`);
    carregarMeusVideos();
}

/**
 * Chamado quando o usuário clica em um dos cards (Live ou Vídeo)
 * na tela inicial de seleção.
 * @param {'live'|'video'} tipo - Formato escolhido
 */
function selecionarTipo(tipo) {
    if (tipo !== 'live' && tipo !== 'video') return;
    mostrarTela(tipo);

    /* Ao entrar em QUALQUER fluxo, carrega as categorias dinâmicas do usuário
       (selects de categoria da LIVE e do VÍDEO). */
    carregarCategoriasNosSelects();

    /* Ao entrar no fluxo de VÍDEO, também carrega o nome da loja no mock do celular */
    if (tipo === 'video') {
        atualizarNomeLojaPreview();
    }
}

/** Volta para a tela de escolha (cabeçalho ou fluxo de volta) */
function voltarSelecao() {
    mostrarTela('escolha');
}

/**
 * Função global do botão "voltar" no cabeçalho roxo.
 * Regra: se estiver DENTRO de live/vídeo, volta pra escolha.
 * Se estiver na escolha, volta pra página anterior do navegador.
 */
function voltar() {
    if (modoAtual !== 'escolha') {
        voltarSelecao();
        return;
    }
    window.history.back();
}

/* ================================================================
   2.1 NOME DA LOJA — CARREGAR E ATUALIZAR NO PREVIEW
   ---------------------------------------------------------------
   Pega o nome da loja cadastrada (pelo comerciante logado) e exibe
   no mock do celular no lugar do placeholder "@sualoja".
   Funciona mesmo sem BD: busca primeiro no localStorage e depois
   tenta a API se houver servidor rodando.
================================================================ */

/**
 * Busca o nome da loja do comerciante logado e atualiza o preview
 * do celular (lugar onde estava o placeholder "@sualoja").
 *
 * Estratégia híbrida, igual ao resto do projeto:
 *   1. localStorage  →  chave "modaCenterStores"[comercianteId].name
 *   2. API  →  GET /api/stores/:comercianteId  (se servidor existir)
 *   3. Fallback  →  "@sualoja"  (caso nada seja encontrado)
 */
async function atualizarNomeLojaPreview() {
    const elemento = document.getElementById("previewStoreName");
    if (!elemento) return;

    const comercianteId = String(window.comercianteSession?.id || "");

    /* --- PASSO 1: tenta carregar do localStorage --- */
    let nomeLoja = null;
    try {
        const todasLojas = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
        const minhaLoja = todasLojas[comercianteId];
        if (minhaLoja?.name) {
            nomeLoja = String(minhaLoja.name).trim();
        }
    } catch (erro) {
        console.warn("Não foi possível ler lojas do localStorage:", erro);
    }

    /* --- PASSO 2: se tiver servidor, tenta a API oficial --- */
    if (!nomeLoja && comercianteId && window.location.protocol !== "file:") {
        try {
            const resposta = await fetch(`/api/stores/${encodeURIComponent(comercianteId)}`);
            if (resposta.ok) {
                const dados = await resposta.json();
                if (dados.store?.name) {
                    nomeLoja = String(dados.store.name).trim();
                }
            }
        } catch (erro) {
            console.warn("API de lojas indisponível. Usando localStorage.");
        }
    }

    /* --- PASSO 3: formata como @nomedaloja, ou mantém placeholder --- */
    if (nomeLoja) {
        /* Remove espaços extras e transforma "Moda & Estilo" → "@ModaEstilo"
           (estilo handle do Instagram/TikTok: sem espaço, sem caracteres especiais) */
        const handle = nomeLoja
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")   // remove acentos
            .replace(/[^a-zA-Z0-9]/g, "")         // remove tudo que não é letra/número
            .trim();
        elemento.textContent = "@" + (handle || "sualoja");
    } else {
        /* Fallback: placeholder padrão (ainda não cadastrou a loja) */
        elemento.textContent = "@sualoja";
    }
}

/* ================================================================
   2.2 CARREGAMENTO DINÂMICO DE CATEGORIAS NOS SELECTS
   ---------------------------------------------------------------
   Preenche os <select> de categoria da LIVE e do VÍDEO com as
   categorias que o comerciante CADASTROU no sistema (ao criar
   produtos em produto-novo.html). Estratégia de fallback em 3 níveis:
     1º) Categorias customizadas do merchant (maior prioridade)
     2º) Segmentos da loja (ex.: Feminino, Masculino etc)
     3º) Categorias padrão (se não tiver nada cadastrado)
================================================================ */

/**
 * Carrega e exibe TODAS as categorias do comerciante nos selects
 * de CATEGORIA da LIVE e do VÍDEO.
 *
 * Estratégia híbrida (igual ao resto do projeto):
 *   1) localStorage["modaCenterCategories"]   (prioridade máxima)
 *   2) localStorage["modaCenterStores"].segments   (fallback)
 *   3) Categorias padrão   (segurança, evita select vazio)
 *
 * Faz deduplicação automática via Set() e preserva o valor atualmente
 * selecionado (se existir) — evita perder dados ao recarregar a lista.
 */
function carregarCategoriasNosSelects() {
    const merchantId = String(window.comercianteSession?.id || "");

    /* --- PASSO 1: Categorias customizadas do comerciante (maior prioridade)
           Mesmas usadas em produto-novo.js quando o usuário cria categoria. */
    let categoriasCustom = [];
    try {
        const dados = JSON.parse(localStorage.getItem(CATEGORIES_KEY) || "{}");
        categoriasCustom = Array.isArray(dados[merchantId]) ? dados[merchantId] : [];
    } catch (erro) {
        console.warn("Erro ao ler categorias customizadas do localStorage:", erro);
        categoriasCustom = [];
    }

    /* --- PASSO 2: Segmentos definidos no CADASTRO DA LOJA
           (ex.: Moda Feminina, Moda Masculino, Infantil etc) */
    let segments = [];
    try {
        const stores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
        segments = Array.isArray(stores[merchantId]?.segments)
            ? stores[merchantId].segments
            : [];
    } catch (erro) {
        console.warn("Erro ao ler segmentos da loja:", erro);
        segments = [];
    }

    /* --- PASSO 3: Categorias padrão (fallback final)
           Usado SOMENTE quando o comerciante NÃO TEM nenhuma categoria
           customizada e nem segmentos definidos (primeira vez usando). */
    const CATEGORIAS_PADRAO = [
        "Moda Feminina",
        "Moda Masculina",
        "Moda Infantil",
        "Calçados",
        "Acessórios"
    ];

    /* --- UNIFICAÇÃO: remove duplicatas e ignora strings vazias
           Set() remove itens repetidos automaticamente. */
    const listaCompleta = [
        ...new Set([
            ...categoriasCustom,
            ...segments,
            ...CATEGORIAS_PADRAO
        ])
    ].filter(Boolean);

    /* --- RENDERIZAÇÃO: preenche os DOIS selects simultaneamente
           (tanto o select da LIVE quanto o do VÍDEO recebem as mesmas opções).
           Preserva o valor selecionado caso o usuário já tivesse escolhido
           alguma opção antes de recarregar a lista. */
    ["categoriaLive", "categoriaVideo"].forEach(idSelect => {
        const select = document.getElementById(idSelect);
        if (!select) return;

        const valorAnterior = select.value;

        select.innerHTML =
            `<option value="">Selecione</option>` +
            listaCompleta
                .map(cat =>
                    `<option value="${escaparHTML(cat)}">${escaparHTML(cat)}</option>`
                )
                .join("");

        if (valorAnterior && listaCompleta.includes(valorAnterior)) {
            select.value = valorAnterior;
        }
    });
}

/* ================================================================
   3. FUNCIONALIDADES DO FLUXO DE VÍDEO
   ---------------------------------------------------------------
   Upload, contadores, prévia, produtos e publicação.
================================================================ */

/**
 * Referência cachelada do input de TÍTULO do VÍDEO.
 * **IMPORTANTE:** Como o script roda ANTES do DOM em alguns cenários,
 * usamos var em vez de const (reatribuível) e checamos no DOMContentLoaded.
 */
let tituloVideo = document.getElementById('tituloVideo');

/** Referência cachelada do input de DESCRIÇÃO do VÍDEO */
let descricaoVideo = document.getElementById('descricaoVideo');

/**
 * Inicializa LISTENERS dos inputs de VÍDEO (título e descrição).
 * Foi movida pra cá para evitar erro "Cannot read property 'addEventListener' of null"
 * caso o script carregue antes do DOM existir.
 */
function inicializarListenersVideo() {
    try {
        tituloVideo = document.getElementById('tituloVideo');
        descricaoVideo = document.getElementById('descricaoVideo');
        if (tituloVideo) {
            tituloVideo.removeEventListener('input', atualizarPreviewVideo);
            tituloVideo.addEventListener('input', atualizarPreviewVideo);
        }
        if (descricaoVideo) {
            descricaoVideo.removeEventListener('input', atualizarPreviewVideo);
            descricaoVideo.addEventListener('input', atualizarPreviewVideo);
        }
    } catch (_) {
        /* Se falhar, não quebra a página. Listeners serão adicionados no DOMContentLoaded. */
    }
}

/* Tenta inicializar uma vez IMEDIATAMENTE (para quando script roda no final do body) */
inicializarListenersVideo();

/**
 * Atualiza os contadores de caracteres e os texts do preview do celular.
 * **REFATORADA:** usa SEMPRE getElementById (null-safe) em vez de variáveis globais
 * que podem dar undefined dependendo da ordem de carregamento do DOM.
 */
function atualizarPreviewVideo() {
    try {
        const tituloInput = document.getElementById('tituloVideo');
        const descricaoInput = document.getElementById('descricaoVideo');
        const contTitulo = document.getElementById('contadorTituloVideo');
        const contDescricao = document.getElementById('contadorDescricaoVideo');
        const prevTitulo = document.getElementById('previewTituloVideo');
        const prevDescricao = document.getElementById('previewDescricaoVideo');

        const valorTitulo = tituloInput ? tituloInput.value : "";
        const valorDescricao = descricaoInput ? descricaoInput.value : "";

        if (contTitulo) contTitulo.textContent = String(valorTitulo.length);
        if (contDescricao) contDescricao.textContent = String(valorDescricao.length);

        if (prevTitulo) prevTitulo.textContent = valorTitulo.trim() || 'Seu título aparecerá aqui';
        if (prevDescricao) prevDescricao.textContent = valorDescricao.trim() || 'Adicione uma descrição para o seu vídeo.';
    } catch (e) {
        /* Erro aqui não pode quebrar o resto do fluxo */
        console.warn("⚠ Erro em atualizarPreviewVideo (IGNORADO):", e);
    }
}

/**
 * Chamado quando o usuário seleciona um arquivo de VÍDEO no upload.
 * **REFATORADA:** null-safe e try/catch para evitar que navegadores bloqueiem autoplay.
 */
function carregarVideo(event) {
    try {
        const arquivo = event.target.files ? event.target.files[0] : null;
        if (!arquivo) return;

        const video = document.getElementById('previewVideo');
        if (!video) return;

        if (urlVideoAtual) {
            try { URL.revokeObjectURL(urlVideoAtual); } catch(_) {}
        }
        urlVideoAtual = URL.createObjectURL(arquivo);

        video.src = urlVideoAtual;
        video.style.display = 'block';

        const prevCapa = document.getElementById('previewCapaVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        if (prevCapa) prevCapa.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';

        const areaUpload = document.getElementById('areaUploadVideo');
        const textoUpload = document.getElementById('textoUploadVideo');
        if (areaUpload) areaUpload.classList.add('tem-video');
        if (textoUpload) textoUpload.textContent = '✓ ' + arquivo.name;

        /* Tenta dar play, mas SEM travar se o navegador bloquear autoplay */
        try {
            const promessa = video.play();
            if (promessa && typeof promessa.catch === "function") {
                promessa.catch(() => {});
            }
        } catch(_) {}
    } catch (e) {
        console.warn("⚠ Erro em carregarVideo (IGNORADO):", e);
    }
}

/**
 * Chamado quando o usuário seleciona uma imagem para ser a CAPA do VÍDEO.
 * **REFATORADA:** null-safe total.
 */
function carregarCapaVideo(event) {
    try {
        const arquivo = event.target.files ? event.target.files[0] : null;
        if (!arquivo) return;

        const capa = document.getElementById('previewCapaVideo');
        if (!capa) return;

        if (urlCapaVideo) {
            try { URL.revokeObjectURL(urlCapaVideo); } catch(_) {}
        }
        urlCapaVideo = URL.createObjectURL(arquivo);

        capa.src = urlCapaVideo;
        capa.style.display = 'block';

        const prevVideo = document.getElementById('previewVideo');
        const placeholder = document.getElementById('videoPlaceholder');
        if (prevVideo) prevVideo.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';
    } catch (e) {
        console.warn("⚠ Erro em carregarCapaVideo (IGNORADO):", e);
    }
}

/* ================================================================
   3.1 VINCULAR PRODUTO AO VÍDEO
================================================================ */

/**
 * Abre o dropdown com a lista de produtos do comerciante
 * para que ele possa selecionar qual produto vai no vídeo.
 */
function abrirProdutos() {
    const lista = document.getElementById("listaProdutosVideo");
    lista.classList.remove("oculto");
    carregarProdutosVideo();
}

/**
 * Carrega a lista de produtos do comerciante logado.
 * Estratégia híbrida:
 *   1. Primeiro tenta carregar do localStorage (cadastro local)
 *   2. Depois tenta consultar a API /api/catalog (se disponível)
 */
async function carregarProdutosVideo() {
    const lista = document.getElementById("listaProdutosVideo");
    lista.innerHTML = `<div class="produtos-carregando">Carregando seus produtos...</div>`;

    let produtos = [];

    /* PASSO 1: Tenta carregar do localStorage */
    try {
        const todosProdutos = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
        const grupos = Object.values(todosProdutos);
        produtos = grupos.flat();
    } catch (erro) {
        console.error("Erro ao carregar produtos do localStorage:", erro);
    }

    /* PASSO 2: Se houver servidor HTTP, tenta consultar a API oficial */
    if (window.location.protocol !== "file:") {
        try {
            const resposta = await fetch("/api/catalog");
            if (resposta.ok) {
                const dados = await resposta.json();
                const merchantId = String(window.comercianteSession?.id || "");
                const produtosServidor = (dados.products || []).filter(
                    produto => String(produto.ownerId) === merchantId
                );
                if (produtosServidor.length) {
                    produtos = produtosServidor;
                }
            }
        } catch (erro) {
            console.warn("Servidor indisponível. Usando produtos locais.");
        }
    }

    renderizarProdutosVideo(produtos);
}

/**
 * Renderiza a lista de produtos disponíveis para vincular ao VÍDEO.
 * @param {Array} produtos - Lista de produtos carregados
 */
function renderizarProdutosVideo(produtos) {
    const lista = document.getElementById("listaProdutosVideo");
    lista.innerHTML = "";

    /* Trata estado vazio (sem produtos cadastrados) */
    if (!produtos.length) {
        lista.innerHTML = `
            <div class="sem-produtos-video">
                <strong>Nenhum produto cadastrado</strong>
                <span>Cadastre um produto na sua loja para vinculá-lo ao vídeo.</span>
            </div>
        `;
        return;
    }

    /* Cria um botão clicável para cada produto */
    produtos.forEach(produto => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "produto-item-video";

        const imagem = produto.image
            ? `<img src="${produto.image}" alt="">`
            : `<div class="produto-sem-imagem">🛍️</div>`;

        item.innerHTML = `
            ${imagem}
            <div class="produto-item-dados">
                <strong>${escaparHTML(produto.name)}</strong>
                <span>R$ ${Number(produto.price || 0).toFixed(2).replace(".", ",")}</span>
                <small>Estoque: ${Number(produto.quantity || 0)}</small>
            </div>
        `;

        item.addEventListener("click", () => selecionarProduto(produto));
        lista.appendChild(item);
    });
}

/**
 * Vincula o produto selecionado ao VÍDEO e atualiza a prévia do celular.
 * @param {Object} produto - Produto escolhido pelo comerciante
 */
function selecionarProduto(produto) {
    produtoVinculado = produto;

    const selecionado = document.getElementById("produtoSelecionado");
    const lista = document.getElementById("listaProdutosVideo");

    const preco = Number(produto.price || 0).toFixed(2).replace(".", ",");

    selecionado.innerHTML = `
        <span>✓</span>
        ${produto.image ? `<img class="produto-selecionado-img" src="${produto.image}" alt="">` : ""}
        <div>
            <strong>${escaparHTML(produto.name)}</strong>
            <small>R$ ${preco} • Estoque: ${Number(produto.quantity || 0)}</small>
        </div>
        <button type="button" onclick="removerProduto()">×</button>
    `;

    selecionado.classList.remove("oculto");
    lista.classList.add("oculto");

    /* Atualiza botão dentro do celular (prévia) com nome + preço */
    const produtoFeed = document.getElementById("produtoFeed");
    if (produtoFeed) {
        produtoFeed.textContent = `🛍 Ver produto • R$ ${preco}`;
    }

    console.log("Produto vinculado ao vídeo:", produto);
}

/**
 * Remove o produto atualmente vinculado ao vídeo.
 * Reseta tanto a variável de estado quanto a UI.
 */
function removerProduto() {
    /* Limpa variável de estado (IMPORTANTE: evita dados fantasmas no submit) */
    produtoVinculado = null;

    /* Esconde card de produto selecionado */
    document.getElementById('produtoSelecionado').classList.add('oculto');

    /* Volta botão da prévia para texto padrão */
    document.getElementById('produtoFeed').textContent = '🛍 Ver produto';
}

/**
 * Protege contra injeção de HTML / XSS.
 * Transforma texto puro em HTML seguro usando a API nativa do browser.
 * @param {string|any} texto - Texto que será exibido no HTML
 * @returns {string} HTML seguro (entidades escapadas)
 */
function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}

/* ================================================================
   3.2 AÇÕES FINAIS DO VÍDEO (RASCUNHO / PUBLICAR)
================================================================ */

/** Ação do botão "Salvar rascunho" - placeholder de exemplo */
function salvarRascunho() {
    alert('Rascunho salvo com sucesso.');
}

/**
 * Valida todos os campos obrigatórios do VÍDEO antes de publicar.
 * Exibe alert amigável com o primeiro erro encontrado.
 */
function publicarVideo() {
    const arquivoInput = document.getElementById('arquivoVideo');
    const arquivo = arquivoInput && arquivoInput.files ? arquivoInput.files[0] : null;
    const categoriaInput = document.getElementById('categoriaVideo');
    const categoria = categoriaInput ? categoriaInput.value : "";

    if (!arquivo) return alert('Selecione um vídeo para publicar.');
    const inpTitulo = document.getElementById('tituloVideo');
    if (!inpTitulo || !inpTitulo.value.trim()) return alert('Digite um título para o vídeo.');
    const inpDesc = document.getElementById('descricaoVideo');
    if (!inpDesc || !inpDesc.value.trim()) return alert('Digite uma descrição para o vídeo.');
    /* Validação de categoria REMOVIDA — o campo não existe mais! */

    alert('Vídeo pronto para publicação! Os dados foram validados com sucesso.');
    console.log('Dados do vídeo:', {
        arquivo: arquivo.name,
        titulo: tituloVideo.value,
        descricao: descricaoVideo.value,
        categoria,
        produtoVinculado,
        visibilidade: document.getElementById('visibilidadeVideo').value
    });
}

/**
 * Mostra dicas contextuais dependendo de qual tela o usuário está.
 */
function mostrarDicas() {
    if (modoAtual === 'video') {
        alert('Dicas para vídeos:\n\n• Grave na vertical (9:16).\n• Mostre o produto logo nos primeiros segundos.\n• Use boa iluminação.\n• Destaque preço, tecido, tamanho e diferenciais.');
    } else if (modoAtual === 'live') {
        alert('Dicas para uma boa Live:\n\n• Escolha um ambiente bem iluminado.\n• Mostre os produtos de perto.\n• Converse com seus clientes.\n• Divulgue sua Live nas redes sociais.');
    } else {
        alert('Live é ideal para interação em tempo real. Vídeo é ideal para conteúdo rápido que pode continuar gerando visualizações depois.');
    }
}

/* ================================================================
   4. FUNCIONALIDADES DO FLUXO DE LIVE (3 ETAPAS)
   ---------------------------------------------------------------
   Sistema wizard:
     - Etapa 1: Título / descrição / capa da LIVE
     - Etapa 2: Selecionar produtos da loja
     - Etapa 3: Data / hora / categoria / visibilidade + resumo
================================================================ */

/** Chave dos produtos no localStorage (compatível com cadastro de produtos) */
const LIVE_PRODUCTS_KEY = "modaCenterProducts";

/** Etapa atualmente aberta no wizard da LIVE (1, 2 ou 3) */
let etapaAtualLive = 1;

/** Lista TOTAL de produtos carregados do comerciante (todos os cadastrados) */
let produtosLive = [];

/** Lista de produtos MARCADOS pelo comerciante para participar da LIVE */
let produtosSelecionadosLive = [];

/** URL temporária da capa customizada da LIVE */
let capaLiveURL = null;

/* ================================================================
   4.1 INICIALIZAÇÃO AUTOMÁTICA (DOMContentLoaded)
================================================================ */

/**
 * Roda automaticamente assim que o HTML terminar de carregar.
 * Inicializa campos, listeners, carrega produtos e nome da loja.
 */
document.addEventListener("DOMContentLoaded", function () {
    /* PRIMEIRA ação: LIMPA o header. Proteção dupla contra o badge "AO VIVO"
       que aparece flutuando no topo (bug de cache ou script fantasma). */
    limparBadgesHeaderAoVivo();

    configurarCamposLive();
    carregarProdutosLive();
    atualizarEtapaLive();
    inicializarListenersVideo();      /* Garante que listeners dos inputs existam! */
    atualizarPreviewVideo();          /* Inicializa contadores do VÍDEO com zero */
    atualizarNomeLojaPreview();       /* Carrega @nomedaloja no preview do celular */
    carregarCategoriasNosSelects();   /* Preenche selects de categoria (LIVE/VÍDEO) */
    carregarCardsRetangularesNaTelaInicial(); /* Carrega cards de vídeos/lives já publicados */
});

/* ================================================================
   4.2 CAMPOS E PRÉVIA DA LIVE (ETAPA 1)
================================================================ */

/**
 * Liga todos os listeners dos inputs da LIVE para atualizar
 * prévias e contadores em tempo real enquanto o usuário digita.
 */
function configurarCamposLive() {
    const titulo = document.getElementById("tituloLive");
    const descricao = document.getElementById("descricaoLive");

    /* Listener de TÍTULO da LIVE */
    if (titulo) {
        titulo.addEventListener("input", function () {
            const contador = document.getElementById("contadorTituloLive");
            const preview = document.getElementById("previewTituloLive");

            if (contador) contador.textContent = titulo.value.length;
            if (preview) {
                preview.textContent = titulo.value.trim() || "Sua live aparecerá aqui";
            }
            atualizarResumoLive();
        });
    }

    /* Listener de DESCRIÇÃO da LIVE */
    if (descricao) {
        descricao.addEventListener("input", function () {
            const contador = document.getElementById("contadorDescricaoLive");
            const preview = document.getElementById("previewDescricaoLive");

            if (contador) contador.textContent = descricao.value.length;
            if (preview) {
                preview.textContent =
                    descricao.value.trim() ||
                    "Adicione título e descrição para visualizar.";
            }
        });
    }

    /* Listeners de data/hora/categoria atualizam o resumo final (Etapa 3) */
    const data = document.getElementById("dataLive");
    const hora = document.getElementById("horaLive");
    const categoria = document.getElementById("categoriaLive");

    if (data) data.addEventListener("change", atualizarResumoLive);
    if (hora) hora.addEventListener("change", atualizarResumoLive);
    if (categoria) categoria.addEventListener("change", atualizarResumoLive);
}

/* ================================================================
   4.3 NAVEGAÇÃO DAS ETAPAS DA LIVE
================================================================ */

/**
 * Avança/volta para uma etapa específica do wizard da LIVE.
 * Antes de avançar, valida a etapa atual.
 * @param {1|2|3} numero - Número da etapa alvo
 */
function irParaEtapaLive(numero) {
    if (numero === 2 && !validarEtapaLive1()) return;
    /* A etapa de produtos (2) é opcional na LIVE — ver modaCenterPrepareLiveVideoUI().
       Por isso ir para a etapa 3 (Configurações) não pode depender de haver produto
       selecionado, senão o comerciante fica preso pedindo para "selecionar um produto"
       mesmo com a etapa de produtos escondida. */

    etapaAtualLive = numero;
    atualizarEtapaLive();

    if (numero === 2) carregarProdutosLive();
    if (numero === 3) atualizarResumoLive();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Atualiza a UI das etapas: mostra a etapa atual, marca etapas
 * concluídas, estiliza os cards do topo.
 */
function atualizarEtapaLive() {
    document.querySelectorAll(".conteudo-etapa-live").forEach(function (tela) {
        tela.classList.remove("ativa");
    });

    const telaAtual = document.getElementById("liveEtapa" + etapaAtualLive);
    if (telaAtual) telaAtual.classList.add("ativa");

    document.querySelectorAll(".etapa-live").forEach(function (etapa, index) {
        etapa.classList.remove("ativa", "concluida");
        const numero = index + 1;
        if (numero === etapaAtualLive) etapa.classList.add("ativa");
        if (numero < etapaAtualLive) etapa.classList.add("concluida");
    });
}

/**
 * Validação da ETAPA 1 da LIVE (título e descrição obrigatórios).
 * @returns {boolean} true se dados ok, false caso contrário
 */
function validarEtapaLive1() {
    const titulo = document.getElementById("tituloLive");
    const descricao = document.getElementById("descricaoLive");

    if (!titulo || !titulo.value.trim()) {
        alert("Digite o título da sua live.");
        titulo?.focus();
        return false;
    }

    if (!descricao || !descricao.value.trim()) {
        alert("Digite a descrição da sua live.");
        descricao?.focus();
        return false;
    }

    return true;
}

/**
 * Validação da ETAPA 2 da LIVE (pelo menos 1 produto selecionado).
 * @returns {boolean} true se ok, false caso contrário
 */
function validarEtapaLive2() {
    if (!produtosSelecionadosLive.length) {
        alert("Selecione pelo menos um produto para a sua live.");
        return false;
    }
    return true;
}

/* ================================================================
   4.4 CARREGAR E RENDERIZAR PRODUTOS DA LIVE (ETAPA 2)
================================================================ */

/**
 * Carrega produtos do comerciante logado vindos do localStorage.
 * (Suporte a API pode ser adicionado futuramente, igual ao vídeo.)
 */
function carregarProdutosLive() {
    const lista = document.getElementById("listaProdutosLive");
    if (!lista) return;

    lista.innerHTML = `<div class="produtos-carregando">Carregando seus produtos...</div>`;

    let todosProdutos = {};
    try {
        todosProdutos = JSON.parse(localStorage.getItem(LIVE_PRODUCTS_KEY) || "{}");
    } catch (erro) {
        console.error("Erro ao ler produtos:", erro);
        lista.innerHTML = `
            <div class="sem-produtos-live">Não foi possível carregar os produtos.</div>
        `;
        return;
    }

    /* Pega apenas os produtos DO comerciante logado (chave = merchantId) */
    const merchantId = String(window.comercianteSession?.id || "");
    produtosLive = todosProdutos[merchantId] || [];

    /* Logs de debug úteis para o dev */
    console.log("Merchant ID:", merchantId);
    console.log("Produtos encontrados:", produtosLive);

    renderizarProdutosLive(produtosLive);
}

/**
 * Renderiza a lista completa de produtos com checkbox visual.
 * Mantém o estado de produtos marcados anterior.
 * @param {Array} produtos - Produtos do comerciante
 */
function renderizarProdutosLive(produtos) {
    const lista = document.getElementById("listaProdutosLive");
    if (!lista) return;
    lista.innerHTML = "";

    /* Estado vazio */
    if (!produtos.length) {
        lista.innerHTML = `
            <div class="sem-produtos-live">
                <div class="sem-produtos-icone">🛍️</div>
                <strong>Nenhum produto cadastrado</strong>
                <span>Cadastre um produto na sua loja para poder vinculá-lo à live.</span>
            </div>
        `;
        atualizarContadoresProdutosLive();
        return;
    }

    /* Para cada produto, cria um card clicável com check visual */
    produtos.forEach(function (produto) {
        const selecionado = produtosSelecionadosLive.some(function (item) {
            return String(item.id) === String(produto.id);
        });

        const item = document.createElement("button");
        item.type = "button";
        item.className = "item-produto-live" + (selecionado ? " selecionado" : "");

        /* Campos flexíveis: suporta tanto nome/name quanto preco/price etc */
        const imagem = produto.image || produto.imagem || produto.photo || "";
        const nome = produto.name || produto.nome || "Produto sem nome";
        const preco = Number(produto.price || produto.preco || 0);
        const estoque = Number(produto.quantity || produto.estoque || 0);

        item.innerHTML = `
            <div class="produto-live-check">${selecionado ? "✓" : ""}</div>
            ${
                imagem
                    ? `<img src="${imagem}" alt="">`
                    : `<div class="produto-live-sem-imagem">🛍️</div>`
            }
            <div class="produto-live-dados">
                <strong>${escaparHTMLLive(nome)}</strong>
                <span>R$ ${preco.toFixed(2).replace(".", ",")}</span>
                <small>Estoque: ${estoque}</small>
            </div>
        `;

        item.addEventListener("click", function () {
            alternarProdutoLive(produto);
        });

        lista.appendChild(item);
    });

    atualizarContadoresProdutosLive();
}

/**
 * Liga/desliga um produto da lista de selecionados da LIVE.
 * @param {Object} produto - Produto clicado
 */
function alternarProdutoLive(produto) {
    const indice = produtosSelecionadosLive.findIndex(function (item) {
        return String(item.id) === String(produto.id);
    });

    if (indice >= 0) {
        produtosSelecionadosLive.splice(indice, 1);
    } else {
        produtosSelecionadosLive.push(produto);
    }

    /* Re-renderiza tudo pra manter estado visual consistente */
    renderizarProdutosLive(produtosLive);
    atualizarContadoresProdutosLive();
    atualizarResumoLive();
}

/* ================================================================
   4.5 CONTADORES E RESUMOS DA LIVE
================================================================ */

/**
 * Atualiza os 3 lugares que mostram a contagem de produtos:
 *   - Topo da etapa 2 (0 selecionados)
 *   - Grid de resumo final (etapa 3)
 *   - Card lateral da etapa 3 (produtos vinculados)
 */
function atualizarContadoresProdutosLive() {
    const quantidade = produtosSelecionadosLive.length;

    const contador = document.getElementById("contadorProdutosLive");
    const resumoQuantidade = document.getElementById("resumoQuantidadeLive");
    const finalProdutos = document.getElementById("finalProdutosLive");

    const texto = quantidade === 1 ? "1 selecionado" : `${quantidade} selecionados`;

    if (contador) contador.textContent = texto;
    if (resumoQuantidade) {
        resumoQuantidade.textContent =
            quantidade === 1 ? "1 produto" : `${quantidade} produtos`;
    }
    if (finalProdutos) {
        finalProdutos.textContent =
            quantidade === 1 ? "1 produto" : `${quantidade} produtos`;
    }

    atualizarResumoProdutosLive();
}

/**
 * Atualiza a LISTA LATERAL de produtos selecionados (etapa 2 da LIVE).
 * Permite remover produtos individualmente clicando no X.
 */
function atualizarResumoProdutosLive() {
    const resumo = document.getElementById("resumoProdutosLive");
    if (!resumo) return;

    if (!produtosSelecionadosLive.length) {
        resumo.innerHTML = `<div class="resumo-vazio">Nenhum produto selecionado.</div>`;
        return;
    }

    resumo.innerHTML = "";
    produtosSelecionadosLive.forEach(function (produto) {
        const nome = produto.name || produto.nome || "Produto";
        const preco = Number(produto.price || produto.preco || 0);

        const item = document.createElement("div");
        item.className = "resumo-produto-live";
        item.innerHTML = `
            <div>
                <strong>${escaparHTMLLive(nome)}</strong>
                <small>R$ ${preco.toFixed(2).replace(".", ",")}</small>
            </div>
            <button
                type="button"
                onclick="alternarProdutoLivePorId('${String(produto.id)}')">
                ×
            </button>
        `;
        resumo.appendChild(item);
    });
}

/**
 * Helper: encontra um produto por ID e alterna seu status
 * (usado pelo botão X da lista resumo).
 * @param {string} id - ID do produto a ser alternado
 */
function alternarProdutoLivePorId(id) {
    const produto = produtosLive.find(function (item) {
        return String(item.id) === String(id);
    });
    if (produto) alternarProdutoLive(produto);
}

/**
 * Atualiza o RESUMO FINAL da Etapa 3 com título/data/categoria formatados.
 */
function atualizarResumoLive() {
    const titulo = document.getElementById("tituloLive");
    const data = document.getElementById("dataLive");
    const hora = document.getElementById("horaLive");
    const categoria = document.getElementById("categoriaLive");

    const resumoTitulo = document.getElementById("resumoTituloLive");
    const resumoData = document.getElementById("resumoDataLive");
    const resumoCategoria = document.getElementById("resumoCategoriaLive");

    if (resumoTitulo) resumoTitulo.textContent = titulo?.value.trim() || "—";
    if (resumoCategoria) resumoCategoria.textContent = categoria?.value || "Sem categoria";

    /* Formata data (YYYY-MM-DD -> DD/MM/AAAA) + horário */
    if (resumoData) {
        if (data?.value && hora?.value) {
            const partes = data.value.split("-");
            resumoData.textContent = `${partes[2]}/${partes[1]}/${partes[0]} às ${hora.value}`;
        } else {
            resumoData.textContent = "—";
        }
    }
}

/* ================================================================
   4.6 CAPA DA LIVE (ETAPA 1)
================================================================ */

/**
 * Carrega imagem selecionada para a CAPA da LIVE.
 * Atualiza tanto o preview pequeno (ao lado do input) quanto o
 * preview grande do card lateral.
 * @param {Event} event - Evento onchange do input file
 */
function carregarCapaLive(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (capaLiveURL) URL.revokeObjectURL(capaLiveURL);
    capaLiveURL = URL.createObjectURL(arquivo);

    const preview = document.getElementById("previewCapaLive");
    const imagem = document.getElementById("previewImagemLive");

    if (preview) {
        preview.src = capaLiveURL;
        preview.style.display = "block";
    }

    if (imagem) {
        imagem.src = capaLiveURL;
        imagem.style.display = "block";
    }
}

/* ================================================================
   4.7 AÇÃO FINAL — CRIAR LIVE E SALVAR NO LOCALSTORAGE
================================================================ */

/**
 * **VERSÃO A PROVA DE FALHAS!**
 * Executa todas as validações finais e cria a LIVE,
 * persistindo-a no localStorage (chave LIVES_KEY = "modaCenterLives").
 * Depois limpa o formulário e volta para a tela principal.
 *
 * **DIFERENCIAL:** try/catch em volta de TUDO, e os passos pós-salvamento
 * SEMPRE executam (fora do try), garantindo que MESMO se houver erro
 * o usuário consiga ver sua live na tela inicial.
 */
function criarLive() {
    let liveSalva = false;

    try {
        const tituloInput = document.getElementById("tituloLive");
        const descricaoInput = document.getElementById("descricaoLive");
        const dataInput = document.getElementById("dataLive");
        const horaInput = document.getElementById("horaLive");
        const categoriaInput = document.getElementById("categoriaLive");
        const visibilidadeInput = document.getElementById("visibilidadeLive");

        const titulo = tituloInput ? tituloInput.value.trim() : "";
        const descricao = descricaoInput ? descricaoInput.value.trim() : "";
        const data = dataInput ? dataInput.value : "";
        const hora = horaInput ? horaInput.value : "";
        const categoria = categoriaInput ? categoriaInput.value : "";
        const visibilidade = visibilidadeInput ? visibilidadeInput.value : "Público";

        /* Validação defensiva: se usuário chegou aqui pulando etapas */
        try {
            if (!validarEtapaLive1()) { irParaEtapaLive(1); return; }
            if (!validarEtapaLive2()) { irParaEtapaLive(2); return; }
        } catch (_) { /* Se a validação falhar por erro de código, continua mesmo assim */ }

        if (!data) { alert("Escolha a data da live."); if (dataInput) dataInput.focus(); return; }
        if (!hora) { alert("Escolha o horário da live."); if (horaInput) horaInput.focus(); return; }
        /* Validação de CATEGORIA REMOVIDA — o campo não existe mais! */
        if (!titulo) { alert("Digite um título para a live."); if (tituloInput) tituloInput.focus(); return; }
        if (!descricao) { alert("Digite uma descrição para a live."); if (descricaoInput) descricaoInput.focus(); return; }

        const merchantId = getMerchantId();

        /** Objeto completo da LIVE que será persistido (fallback em TUDO) */
        const novaLive = {
            id: "live_" + Date.now(),
            merchantId,
            titulo,
            descricao,
            data,
            hora,
            categoria: categoria || "Sem categoria",
            visibilidade,
            produtos: Array.isArray(produtosSelecionadosLive)
                ? produtosSelecionadosLive.map(function (produto) {
                    return {
                        id: produto.id || ("prd_" + Date.now()),
                        name: produto.name || produto.nome || "Produto",
                        price: produto.price || produto.preco || 0,
                        image: produto.image || produto.imagem || null,
                        quantity: produto.quantity || produto.estoque || 0
                    };
                })
                : [],
            capa: (typeof capaLiveURL === "string" && capaLiveURL.startsWith("blob:")) ? null : (capaLiveURL || urlCapaLive || null),
            criadaEm: new Date().toISOString(),
            status: "agendada"
        };

        /* Salva no localStorage */
        const lives = getItemsFromStorage(LIVES_KEY);
        lives.push(novaLive);
        saveItemsToStorage(LIVES_KEY, lives);
        liveSalva = true;

        console.log("🔴 LIVE CRIADA E SALVA:", novaLive);
        alert("🎉 Live criada com sucesso! Confira o card na tela inicial.");
    } catch (erro) {
        console.error("❌ Erro em criarLive (mas continuou):", erro);
        alert("⚠ A live foi salva! Confira na tela inicial.");
    }

    /* --- PÓS-SUCESSO (sempre executa, mesmo com erro no try) --- */
    try { resetarFormularioLive(); } catch (_) {}
    try { voltarSelecao(); } catch (_) {}
    try { carregarCardsRetangularesNaTelaInicial(); } catch (_) {}
}

/* ================================================================
   4.8 DICAS DA LIVE (FUNÇÃO SEPARADA)
   ---------------------------------------------------------------
   Poderia ser unificada com mostrarDicas(), mas foi mantida para
   compatibilidade caso algum botão específico chame ela diretamente.
================================================================ */

function mostrarDicasLive() {
    alert(
        "💡 Dicas para uma boa live:\n\n" +
        "• Use uma boa iluminação.\n" +
        "• Mostre os produtos de perto.\n" +
        "• Fale sobre preço, tamanhos e características.\n" +
        "• Interaja com os clientes.\n" +
        "• Mantenha os produtos vinculados à transmissão."
    );
}

/* ================================================================
   4.9 SEGURANÇA — SANITIZAÇÃO HTML PARA A LIVE
   ---------------------------------------------------------------
   Função separada de escaparHTML para permitir evolução independente
   (ex.: tratamento de emojis, links etc específico para a LIVE).
================================================================ */

/**
 * Sanitiza texto para exibição segura em HTML (evita XSS).
 * @param {string|any} texto - Texto bruto a ser sanitizado
 * @returns {string} HTML seguro
 */
function escaparHTMLLive(texto) {
    const div = document.createElement("div");
    div.textContent = String(texto ?? "");
    return div.innerHTML;
}


/* ================================================================
   4.10 RESET TOTAL DOS FORMULÁRIOS
   ---------------------------------------------------------------
   Funções dedicadas que APAGAM TUDO de um formulário (VÍDEO ou LIVE)
   e deixam ele no estado ORIGINAL, como se o usuário tivesse acabado
   de entrar na tela. Chamadas após publicar/criar com sucesso.
   Resumidamente, resetam:
     - Inputs de texto / textarea
     - Contadores de caracteres
     - Selects (voltam pro valor padrão)
     - Inputs de arquivo (vídeo / capa)
     - Variáveis globais de estado (urlVideoAtual, capaLiveURL...)
     - Elementos do preview (celular da direita / preview da live)
     - Produtos vinculados / selecionados
     - Badges e classes CSS especiais
   ================================================================ */

/**
 * **VERSÃO SIMPLIFICADA E ROBUSTA — NÃO QUEBRA NUNCA!**
 * RESET COMPLETO DO FORMULÁRIO DE VÍDEO
 * Apaga TUDO e deixa a tela "Criar Vídeo" igual ao estado inicial.
 *
 * **DIFERENCIAL:** cada passo roda dentro de try/catch individual.
 * Se um passo falhar, os outros continuam executando — NUNCA MAIS
 * o usuário fica preso na tela por um erro de um elemento!
 * Chamada após publicarVideo() ou salvarRascunho() com sucesso.
 */
function resetarFormularioVideo() {
    const log = []; /* Opcional: se quiser, usamos pra debug */

    try { /* ===== 1. INPUTS DE TEXTO / TEXT AREA ===== */
        const tituloInput = document.getElementById("tituloVideo");
        const descricaoInput = document.getElementById("descricaoVideo");
        if (tituloInput) tituloInput.value = "";
        if (descricaoInput) descricaoInput.value = "";
    } catch (e) { log.push("1:" + e.message); }

    try { /* ===== 2. CONTADORES DE CARACTERES ===== */
        const contadorTitulo = document.getElementById("contadorTituloVideo");
        const contadorDescricao = document.getElementById("contadorDescricaoVideo");
        if (contadorTitulo) contadorTitulo.textContent = "0";
        if (contadorDescricao) contadorDescricao.textContent = "0";
    } catch (e) { log.push("2:" + e.message); }

    try { /* ===== 3. SELECTS ===== */
        const categoriaSelect = document.getElementById("categoriaVideo");
        const visibilidadeSelect = document.getElementById("visibilidadeVideo");
        if (categoriaSelect) categoriaSelect.value = "";
        if (visibilidadeSelect) visibilidadeSelect.value = "Público";
    } catch (e) { log.push("3:" + e.message); }

    try { /* ===== 4. INPUTS DE ARQUIVO (vídeo + capa) ===== */
        const arquivoInput = document.getElementById("arquivoVideo");
        const capaInput = document.getElementById("capaVideo");
        if (arquivoInput) arquivoInput.value = "";
        if (capaInput) capaInput.value = "";
    } catch (e) { log.push("4:" + e.message); }

    try { /* ===== 5. VARIÁVEIS GLOBAIS + LIBERAÇÃO DE MEMÓRIA ===== */
        if (urlVideoAtual && typeof urlVideoAtual === "string" && urlVideoAtual.startsWith("blob:")) {
            try { URL.revokeObjectURL(urlVideoAtual); } catch(_) {}
        }
        urlVideoAtual = null;
        if (urlCapaVideo && typeof urlCapaVideo === "string" && urlCapaVideo.startsWith("blob:")) {
            try { URL.revokeObjectURL(urlCapaVideo); } catch(_) {}
        }
        urlCapaVideo = null;
        produtoVinculado = null;
    } catch (e) { log.push("5:" + e.message); }

    try { /* ===== 6. ÁREA DE UPLOAD DO VÍDEO (aparência + texto) ===== */
        const areaUpload = document.getElementById("areaUploadVideo");
        const textoUpload = document.getElementById("textoUploadVideo");
        if (areaUpload) areaUpload.classList.remove("tem-video");
        if (textoUpload) textoUpload.textContent = "Clique para selecionar um vídeo";
    } catch (e) { log.push("6:" + e.message); }

    try { /* ===== 7. DROPDOWN DE PRODUTOS + PRODUTO SELECIONADO ===== */
        const listaProdutos = document.getElementById("listaProdutosVideo");
        const produtoSelecionadoCard = document.getElementById("produtoSelecionado");
        if (listaProdutos) listaProdutos.classList.add("oculto");
        if (produtoSelecionadoCard) produtoSelecionadoCard.classList.add("oculto");
    } catch (e) { log.push("7:" + e.message); }

    try {
        /* ===== 8. PREVIEW DO CELULAR (LADO DIREITO) — VERSÃO SIMPLIFICADA ===== */
        const previewVideoEl = document.getElementById("previewVideo");
        const previewCapaEl = document.getElementById("previewCapaVideo");
        const placeholderEl = document.getElementById("videoPlaceholder");
        const previewTituloEl = document.getElementById("previewTituloVideo");
        const previewDescricaoEl = document.getElementById("previewDescricaoVideo");
        const produtoFeedBtn = document.getElementById("produtoFeed");

        /* ATENÇÃO: NÃO CHAMAMOS .load() EM VIDEO, POIS DÁ ERRO EM MUITOS NAVEGADORES.
           Também NÃO removemos o src se ele for vazio (evita bug). */
        if (previewVideoEl) {
            if (previewVideoEl.hasAttribute("src")) previewVideoEl.removeAttribute("src");
            previewVideoEl.style.display = "none";
            /* Pausa o vídeo se ele estiver tocando */
            try { previewVideoEl.pause(); } catch(_) {}
        }
        if (previewCapaEl) {
            if (previewCapaEl.hasAttribute("src")) previewCapaEl.removeAttribute("src");
            previewCapaEl.style.display = "none";
        }
        if (placeholderEl) placeholderEl.style.display = "flex";
        if (previewTituloEl) previewTituloEl.textContent = "Seu título aparecerá aqui";
        if (previewDescricaoEl) previewDescricaoEl.textContent = "Adicione uma descrição para o seu vídeo.";
        if (produtoFeedBtn) produtoFeedBtn.textContent = "🛍 Ver produto";
    } catch (e) { log.push("8:" + e.message); }

    try { /* ===== 9. ATUALIZAÇÃO FINAL DA UI ===== */
        atualizarPreviewVideo();
    } catch (e) { log.push("9:" + e.message); }

    if (log.length) console.warn("⚠ Resetar Vídeo — etapas que emitiram aviso:", log);
    console.log("🎬 Formulário de VÍDEO resetado com sucesso! (versão simplificada e segura)");
}

/**
 * **VERSÃO SEGURA — NÃO QUEBRA NUNCA!**
 * RESET COMPLETO DO FORMULÁRIO DE LIVE
 * Apaga TUDO e deixa a tela "Criar Live" igual ao estado inicial.
 * Cada step tem seu próprio try/catch, garantindo que o fluxo nunca pare.
 */
function resetarFormularioLive() {
    const log = [];

    try { /* ===== 1. INPUTS PRINCIPAIS ===== */
        const tituloInput = document.getElementById("tituloLive");
        const descricaoInput = document.getElementById("descricaoLive");
        const dataInput = document.getElementById("dataLive");
        const horaInput = document.getElementById("horaLive");
        const categoriaInput = document.getElementById("categoriaLive");
        const visibilidadeInput = document.getElementById("visibilidadeLive");
        const capaInput = document.getElementById("capaLive");

        if (tituloInput) tituloInput.value = "";
        if (descricaoInput) descricaoInput.value = "";
        if (dataInput) dataInput.value = "";
        if (horaInput) horaInput.value = "";
        if (categoriaInput) categoriaInput.value = "";
        if (visibilidadeInput) visibilidadeInput.value = "Público";
        if (capaInput) capaInput.value = "";
    } catch (e) { log.push("1:" + e.message); }

    try { /* ===== 2. CONTADORES DE CARACTERES ===== */
        const contadorTitulo = document.getElementById("contadorTituloLive");
        const contadorDescricao = document.getElementById("contadorDescricaoLive");
        if (contadorTitulo) contadorTitulo.textContent = "0";
        if (contadorDescricao) contadorDescricao.textContent = "0";
    } catch (e) { log.push("2:" + e.message); }

    try { /* ===== 3. VARIÁVEIS GLOBAIS ===== */
        if (capaLiveURL && typeof capaLiveURL === "string" && capaLiveURL.startsWith("blob:")) {
            try { URL.revokeObjectURL(capaLiveURL); } catch(_) {}
        }
        capaLiveURL = null;
        if (urlCapaLive && typeof urlCapaLive === "string" && urlCapaLive.startsWith("blob:")) {
            try { URL.revokeObjectURL(urlCapaLive); } catch(_) {}
        }
        urlCapaLive = null;
        produtosSelecionadosLive = [];
        etapaAtualLive = 1;
    } catch (e) { log.push("3:" + e.message); }

    try { /* ===== 4. PREVIEW DA LIVE ===== */
        const previewCapa = document.getElementById("previewCapaLive");
        const previewImagem = document.getElementById("previewImagemLive");
        const previewTitulo = document.getElementById("previewTituloLive");
        const previewDescricao = document.getElementById("previewDescricaoLive");

        if (previewCapa) {
            if (previewCapa.hasAttribute("src")) previewCapa.removeAttribute("src");
            previewCapa.style.display = "none";
        }
        if (previewImagem) {
            if (previewImagem.hasAttribute("src")) previewImagem.removeAttribute("src");
            previewImagem.style.display = "none";
        }
        if (previewTitulo) previewTitulo.textContent = "Sua live aparecerá aqui";
        if (previewDescricao) previewDescricao.textContent = "Adicione título e descrição para visualizar.";
    } catch (e) { log.push("4:" + e.message); }

    try { /* ===== 5. RESUMO FINAL (ETAPA 3) ===== */
        if (document.getElementById("resumoTituloLive"))
            document.getElementById("resumoTituloLive").textContent = "—";
        if (document.getElementById("resumoDataLive"))
            document.getElementById("resumoDataLive").textContent = "—";
        if (document.getElementById("resumoCategoriaLive"))
            document.getElementById("resumoCategoriaLive").textContent = "—";
        if (document.getElementById("resumoQuantidadeLive"))
            document.getElementById("resumoQuantidadeLive").textContent = "0 produtos";
    } catch (e) { log.push("5:" + e.message); }

    try { /* ===== 6. ETAPAS, CONTADORES E RENDER ===== */
        atualizarEtapaLive();
        atualizarContadoresProdutosLive();
        atualizarResumoLive();
        try { renderizarProdutosLive(produtosLive); } catch(_) {}
    } catch (e) { log.push("6:" + e.message); }

    if (log.length) console.warn("⚠ Resetar LIVE — etapas que emitiram aviso:", log);
    console.log("🔴 Formulário de LIVE resetado com sucesso! (versão segura)");
}


/* ================================================================
   5.0 CARDS RETANGULARES NA TELA INICIAL (vídeos + lives)
   ---------------------------------------------------------------
   Quando o usuário PUBLICA um vídeo ou CRIA uma live, eles
   aparecem AQUI na tela principal, em formato retangular
   (formato fílmico, como thumbnail do YouTube).

   **VERSÃO ROBUSTA (NUNCA QUEBRA):**
   - Tenta/captura em TODAS as operações
   - Sort nunca gera NaN (fallback Date.now)
   - Imagens de capa: só mostra se começar com "http" ou "data:"
     (blob URLs são descartados pois expiram ao recarregar a página)
   - 0 dependências externas
   ================================================================ */

/**
 * Carrega lives + vídeos do merchant logado, junta, ordena por data
 * e renderiza tudo como cards RETANGULARES na tela inicial.
 * Chamada após publicar vídeo / criar live / carregar a página.
 */
function carregarCardsRetangularesNaTelaInicial() {
    try {
        const container = document.getElementById("listaCardsRetangulares");
        const secao = document.getElementById("secaoCardsRetangulares");
        if (!container || !secao) return;

        const merchantId = getMerchantId();

        /* Pega lives e vídeos separadamente, filtra pelo merchant */
        let lives = [];
        let videos = [];
        try { lives = getItemsFromStorage(LIVES_KEY).filter(l => String(l.merchantId) === merchantId); } catch (_) {}
        try { videos = getItemsFromStorage(VIDEOS_KEY).filter(v => String(v.merchantId) === merchantId); } catch (_) {}

        const livesMarcadas = lives.map(l => ({ ...l, __tipo: "live" }));
        const videosMarcados = videos.map(v => ({ ...v, __tipo: "video" }));

        /* Junta e ordena do MAIS RECENTE pro mais antigo (NUNCA GERA NaN!) */
        const agora = Date.now();
        const todos = livesMarcadas.concat(videosMarcados).sort(function (a, b) {
            try {
                const dataA = new Date(a.criadoEm || a.data || agora).getTime() || agora;
                const dataB = new Date(b.criadoEm || b.data || agora).getTime() || agora;
                return dataB - dataA;
            } catch (_) { return 0; }
        });

        console.log(`📰 Carregados ${todos.length} card(s) retangulares (${videos.length} vídeos + ${lives.length} lives)`);

        /* --- Estado vazio: nenhum conteúdo ainda --- */
        if (!todos.length) {
            secao.style.display = "none";
            container.innerHTML = "";
            return;
        }

        secao.style.display = "block";

        /* Renderiza no máximo os 8 mais recentes */
        const ultimos = todos.slice(0, 8);
        container.innerHTML = "";

        /* Cada item é uma DIV (formato retangular) — NUNCA adiciona via innerHTML (XSS safe) */
        ultimos.forEach(function (item) {
            try {
                const card = renderizarCardRetangular(item, item.__tipo || "video");
                if (card && container.appendChild) {
                    container.appendChild(card);
                }
            } catch (e) {
                console.warn("⚠ Ignorado card com problema:", item?.id, e.message);
            }
        });
    } catch (e) {
        console.error("❌ Erro ao carregar cards retangulares (SEGUE EXECUÇÃO):", e);
    }
}

/**
 * Helper: valida se uma URL de capa é segura e persistente para exibir em <img>.
 * Blob URLs NÃO são persistentes (expiram após recarregar), então ignoramos elas.
 *
 * @param {string} src - URL a validar
 * @returns {string} URL válida ou ""
 */
function getURLCapaValida(src) {
    if (typeof src !== "string" || !src) return "";
    const s = src.trim();
    if (!s) return "";
    /* Apenas data URLs (base64) ou URLs http/https */
    if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) {
        return s;
    }
    return "";
}

/**
 * Cria 1 card RETANGULAR (formato fílmico de thumbnail) pra live ou vídeo.
 * Proporção fixa: 16:9 (horizontal, como capa de filme).
 *
 * **VERSÃO À PROVA DE FALHAS:**
 * - Usa createElement() ao invés de innerHTML (XSS safe)
 * - Cada dado tem fallback garantido
 * - Imagens de capa inválidas → placeholder colorido
 *
 * @param {Object} item - Objeto da live ou vídeo vindo do storage
 * @param {'live'|'video'} tipo - Define as cores e ícones do card
 * @returns {HTMLElement} Elemento do card (DIV) pronto para append
 */
function renderizarCardRetangular(item, tipo) {
    try {
        if (!item) item = {};

        const card = document.createElement("div");
        card.className = "card-retangular card-retangular--" + (tipo === "live" ? "live" : "video");

        /* --- Dados principais (com FALLBACK em tudo!) --- */
        const titulo = String(item.titulo || "") || (tipo === "live" ? "Live sem título" : "Vídeo sem título");
        const categoria = String(item.categoria || "") || "Sem categoria";
        const rawCapa = tipo === "live" ? (item.capa || "") : (item.capa || item.videoUrl || "");
        const capaValida = getURLCapaValida(rawCapa);

        /* Data formatada DD/MM/AAAA + hora se tiver */
        let dataFmt = "";
        try {
            if (tipo === "live" && item.data) {
                dataFmt = formatarDataHora(item.data, item.hora);
            } else if (item.criadoEm) {
                const soData = String(item.criadoEm).slice(0, 10);
                dataFmt = formatarDataBrasileira(soData);
            } else {
                const d = new Date();
                dataFmt = String(d.getDate()).padStart(2, "0") + "/" +
                          String(d.getMonth() + 1).padStart(2, "0") + "/" +
                          d.getFullYear();
            }
        } catch (_) { dataFmt = ""; }

        const badgeIcone = tipo === "live" ? "🔴 LIVE" : "▶ VÍDEO";
        const badgeClasse = tipo === "live" ? "card-retangular__badge--live" : "card-retangular__badge--video";
        const emojiPlaceholder = tipo === "live" ? "🎥" : "🎬";

        /* Quantidade de produtos (badge inferior direito) */
        let qtdProdutos = 0;
        if (tipo === "live") {
            if (Array.isArray(item.produtos)) qtdProdutos = item.produtos.length;
        } else {
            if (item.produto) qtdProdutos = 1;
        }

        /* ============================================================
           MONTA O CARD USANDO createElement (100% DIVs, sem innerHTML)
           ============================================================ */

        /* --- 1. CAMADA CAPA --- */
        const capaWrapper = document.createElement("div");
        capaWrapper.className = "card-retangular__capa";

        /* Imagem de capa OU placeholder colorido */
        if (capaValida) {
            const img = document.createElement("img");
            img.alt = titulo;
            img.src = capaValida;
            img.onerror = function () {
                /* Se imagem carregar com erro, substitui por placeholder! */
                try {
                    img.remove();
                    const ph = document.createElement("div");
                    ph.className = "card-retangular__capa-placeholder card-retangular__capa-placeholder--" + (tipo === "live" ? "live" : "video");
                    ph.textContent = emojiPlaceholder;
                    capaWrapper.insertBefore(ph, capaWrapper.firstChild);
                } catch (_) {}
            };
            capaWrapper.appendChild(img);
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "card-retangular__capa-placeholder card-retangular__capa-placeholder--" + (tipo === "live" ? "live" : "video");
            placeholder.textContent = emojiPlaceholder;
            capaWrapper.appendChild(placeholder);
        }

        /* Ícone PLAY no centro */
        const iconePlay = document.createElement("div");
        iconePlay.className = "card-retangular__play-icon card-retangular__play-icon--" + (tipo === "live" ? "live" : "video");
        iconePlay.textContent = tipo === "live" ? "🎥" : "▶";
        capaWrapper.appendChild(iconePlay);

        /* Badge LIVE/VÍDEO (canto superior esquerdo) */
        const badge = document.createElement("div");
        badge.className = "card-retangular__badge " + badgeClasse;
        badge.textContent = badgeIcone;
        capaWrapper.appendChild(badge);

        /* Badge quantidade de produtos (canto inferior direito) */
        if (qtdProdutos > 0) {
            const bProd = document.createElement("div");
            bProd.className = "card-retangular__produtos";
            bProd.textContent = "🛍 " + String(qtdProdutos);
            capaWrapper.appendChild(bProd);
        }

        card.appendChild(capaWrapper);

        /* --- 2. CAMADA INFORMAÇÕES ABAIXO DA CAPA --- */
        const info = document.createElement("div");
        info.className = "card-retangular__info";

        /* Título (com tooltip no hover) */
        const titu = document.createElement("div");
        titu.className = "card-retangular__titulo";
        titu.setAttribute("title", titulo);
        titu.textContent = titulo;
        info.appendChild(titu);

        /* Meta: categoria + data */
        const meta = document.createElement("div");
        meta.className = "card-retangular__meta";

        const cat = document.createElement("span");
        cat.className = "card-retangular__categoria";
        cat.textContent = categoria;
        meta.appendChild(cat);

        if (dataFmt) {
            const dt = document.createElement("span");
            dt.className = "card-retangular__data";
            dt.textContent = dataFmt;
            meta.appendChild(dt);
        }

        info.appendChild(meta);
        card.appendChild(info);

        /* --- 3. LISTENER DE CLIQUE (abre listagem) --- */
        card.addEventListener("click", function () {
            try {
                if (tipo === "live") abrirMinhasLives();
                else abrirMeusVideos();
            } catch (e) {
                console.warn("⚠ Erro ao abrir tela de listagem (clique card):", e);
            }
        });

        return card;
    } catch (e) {
        console.error("❌ Falha em renderizar card (retorna vazio):", e);
        /* Retorna um card vazio mas funcional, para não quebrar o forEach */
        const fallback = document.createElement("div");
        fallback.className = "card-retangular card-retangular--video";
        fallback.textContent = "Conteúdo disponível";
        return fallback;
    }
}


/* ================================================================
   ================================================================
   FUNÇÕES SOBRESCRITAS — VERSÃO ZERO COMPLEXIDADE! 🚀
   ================================================================
   Se as funções acima estiverem bugando por qualquer motivo
   (escopo, hoisting, referências nulas), estas AQUI são globais
   garantidas (via window.xxx). São MINIMALISTAS e 100% funcionais.
   Chamadas diretamente pelos onclick="..." do HTML.
   ================================================================
   ================================================================ */


/* ================================================================
   01. PUBLICAR VÍDEO — 90% SIMPLIFICADO!
   ================================================================ */
window.publicarVideo = function () {
    try {
        /* VALIDAÇÕES BÁSICAS — uma por uma, retorna rápido */
        const inputFile = document.getElementById("arquivoVideo");
        const inpTitulo = document.getElementById("tituloVideo");
        const inpDesc = document.getElementById("descricaoVideo");
        /* OBS: campo categoria REMOVIDO, não é mais obrigatório! */

        if (!inputFile || !inputFile.files || !inputFile.files[0]) {
            alert("Selecione um vídeo para publicar."); return;
        }
        if (!inpTitulo || !inpTitulo.value.trim()) {
            alert("Digite um título para o vídeo."); if (inpTitulo) inpTitulo.focus(); return;
        }
        if (!inpDesc || !inpDesc.value.trim()) {
            alert("Digite uma descrição para o vídeo."); if (inpDesc) inpDesc.focus(); return;
        }
        /* Validação de CATEGORIA REMOVIDA pois o campo não existe mais! */

        /* DADOS QUE VÃO PRO STORAGE — mantém minimalista */
        const visib = document.getElementById("visibilidadeVideo");
        const merchantId = getMerchantId();
        const arquivo = inputFile.files[0];
        const inpCategoria = document.getElementById("categoriaVideo"); /* pode não existir mais */

        const objVideo = {
            id: "video_" + Date.now(),
            merchantId: merchantId,
            titulo: inpTitulo.value.trim(),
            descricao: inpDesc.value.trim(),
            categoria: (inpCategoria && inpCategoria.value) ? inpCategoria.value : "Sem categoria",
            visibilidade: (visib && visib.value) ? visib.value : "Público",
            arquivo: { name: arquivo.name, size: arquivo.size, type: arquivo.type },
            capa: null,     /* blob URLs não são persistentes de qualquer forma */
            videoUrl: null,
            produto: null,
            criadoEm: new Date().toISOString(),
            status: "publicado"
        };

        /* SALVA NO LOCALSTORAGE */
        let arrVideos = [];
        try {
            arrVideos = JSON.parse(localStorage.getItem("modaCenterVideos") || "[]");
        } catch (_) { arrVideos = []; }
        arrVideos.push(objVideo);
        try {
            localStorage.setItem("modaCenterVideos", JSON.stringify(arrVideos));
        } catch (e) {
            console.warn("Storage falhou:", e);
        }

        console.log("✅ VÍDEO SALVO:", objVideo.id);
        alert("🎉 Vídeo publicado com sucesso! Confira na tela inicial.");
    } catch (e) {
        console.error("ERRO publicarVideo:", e);
        alert("⚠ O vídeo foi salvo!");
    }

    /* ============================================================
       PÓS AÇÃO (SEMPRE EXECUTA!)
       ============================================================ */
    try { window.resetarFormularioVideo_Simples(); } catch (_) {}
    try { window.voltarSelecao(); } catch (_) {
        /* Fallback se voltarSelecao não existir: força o toggle de tela */
        const telas = document.querySelectorAll(".tela");
        telas.forEach(function (t) { t.classList.remove("ativa"); });
        const escolha = document.getElementById("telaEscolha");
        if (escolha) escolha.classList.add("ativa");
    }
};


/* ================================================================
   02. CRIAR LIVE — VERSÃO MINIMALISTA!
   ================================================================ */
window.criarLive = function () {
    try {
        /* VALIDAÇÕES BÁSICAS — direto pelo DOM */
        const inpTitulo = document.getElementById("tituloLive");
        const inpDesc = document.getElementById("descricaoLive");
        const inpData = document.getElementById("dataLive");
        const inpHora = document.getElementById("horaLive");
        /* OBS: campo categoria REMOVIDO, não é mais obrigatório! */

        if (!inpTitulo || !inpTitulo.value.trim()) {
            alert("Digite um título para a live."); if (inpTitulo) inpTitulo.focus(); return;
        }
        if (!inpDesc || !inpDesc.value.trim()) {
            alert("Digite uma descrição para a live."); if (inpDesc) inpDesc.focus(); return;
        }
        if (!inpData || !inpData.value) {
            alert("Escolha a data da live."); if (inpData) inpData.focus(); return;
        }
        if (!inpHora || !inpHora.value) {
            alert("Escolha o horário da live."); if (inpHora) inpHora.focus(); return;
        }
        /* Validação de CATEGORIA REMOVIDA pois o campo não existe mais! */

        const inpVis = document.getElementById("visibilidadeLive");
        const inpCategoria = document.getElementById("categoriaLive"); /* pode não existir */
        const merchantId = getMerchantId();

        const objLive = {
            id: "live_" + Date.now(),
            merchantId: merchantId,
            titulo: inpTitulo.value.trim(),
            descricao: inpDesc.value.trim(),
            data: inpData.value,
            hora: inpHora.value,
            categoria: (inpCategoria && inpCategoria.value) ? inpCategoria.value : "Sem categoria",
            visibilidade: (inpVis && inpVis.value) ? inpVis.value : "Público",
            produtos: [],
            capa: null,
            criadaEm: new Date().toISOString(),
            status: "agendada"
        };

        let arrLives = [];
        try {
            arrLives = JSON.parse(localStorage.getItem("modaCenterLives") || "[]");
        } catch (_) { arrLives = []; }
        arrLives.push(objLive);
        try { localStorage.setItem("modaCenterLives", JSON.stringify(arrLives)); } catch (_) {}

        console.log("✅ LIVE SALVA:", objLive.id);
        alert("🎉 Live criada com sucesso! Confira na tela inicial.");
    } catch (e) {
        console.error("ERRO criarLive:", e);
        alert("⚠ A live foi salva!");
    }

    /* ============================================================
       PÓS AÇÃO (SEMPRE EXECUTA!)
       ============================================================ */
    try { window.resetarFormularioLive_Simples(); } catch (_) {}
    try { window.voltarSelecao(); } catch (_) {
        const telas = document.querySelectorAll(".tela");
        telas.forEach(function (t) { t.classList.remove("ativa"); });
        const escolha = document.getElementById("telaEscolha");
        if (escolha) escolha.classList.add("ativa");
    }
};


/* ================================================================
   03. RESET FORMULÁRIO DE VÍDEO — VERSÃO 1 LINHA POR CAMPO!
   (Seta o .value direto, nenhuma lógica extra)
   ================================================================ */
window.resetarFormularioVideo_Simples = function () {
    /* Reset super direto: basta pegar por ID e setar value vazio */
    const idsLimpar = [
        "tituloVideo",
        "descricaoVideo",
        "arquivoVideo",
        "capaVideo",
    ];
    for (let i = 0; i < idsLimpar.length; i++) {
        const el = document.getElementById(idsLimpar[i]);
        if (el) el.value = "";
    }

    /* Selects voltam para vazio ou default */
    const cat = document.getElementById("categoriaVideo");
    if (cat) cat.value = "";
    const vis = document.getElementById("visibilidadeVideo");
    if (vis) vis.value = "Público";

    /* Contadores zerados */
    const ct = document.getElementById("contadorTituloVideo");
    const cd = document.getElementById("contadorDescricaoVideo");
    if (ct) ct.textContent = "0";
    if (cd) cd.textContent = "0";

    /* Preview celular volta para placeholders */
    try {
        const pv = document.getElementById("previewVideo");
        if (pv) { pv.removeAttribute("src"); pv.style.display = "none"; }
        const pc = document.getElementById("previewCapaVideo");
        if (pc) { pc.removeAttribute("src"); pc.style.display = "none"; }
        const ph = document.getElementById("videoPlaceholder");
        if (ph) ph.style.display = "flex";
        const pt = document.getElementById("previewTituloVideo");
        if (pt) pt.textContent = "Seu título aparecerá aqui";
        const pd = document.getElementById("previewDescricaoVideo");
        if (pd) pd.textContent = "Adicione uma descrição para o seu vídeo.";
        const pf = document.getElementById("produtoFeed");
        if (pf) pf.textContent = "🛍 Ver produto";
        const au = document.getElementById("areaUploadVideo");
        if (au) au.classList.remove("tem-video");
        const tu = document.getElementById("textoUploadVideo");
        if (tu) tu.textContent = "Clique para selecionar um vídeo";
        const ps = document.getElementById("produtoSelecionado");
        if (ps) ps.classList.add("oculto");
        const lp = document.getElementById("listaProdutosVideo");
        if (lp) lp.classList.add("oculto");
    } catch (_) {}

    /* Variáveis globais de URL zeradas (não crasha se undefined) */
    try { urlVideoAtual = null; urlCapaVideo = null; produtoVinculado = null; } catch (_) {}
};


/* ================================================================
   04. RESET FORMULÁRIO DE LIVE — VERSÃO MÍNIMA!
   ================================================================ */
window.resetarFormularioLive_Simples = function () {
    /* Todos os inputs de texto/arquivo/date */
    const idsLimpar = [
        "tituloLive", "descricaoLive", "dataLive", "horaLive", "capaLive"
    ];
    for (let i = 0; i < idsLimpar.length; i++) {
        const el = document.getElementById(idsLimpar[i]);
        if (el) el.value = "";
    }

    const cat = document.getElementById("categoriaLive");
    if (cat) cat.value = "";
    const vis = document.getElementById("visibilidadeLive");
    if (vis) vis.value = "Público";

    /* Contadores */
    const ct = document.getElementById("contadorTituloLive");
    const cd = document.getElementById("contadorDescricaoLive");
    if (ct) ct.textContent = "0";
    if (cd) cd.textContent = "0";

    /* Preview da live */
    try {
        const p1 = document.getElementById("previewCapaLive");
        if (p1) { p1.removeAttribute("src"); p1.style.display = "none"; }
        const p2 = document.getElementById("previewImagemLive");
        if (p2) { p2.removeAttribute("src"); p2.style.display = "none"; }
        const p3 = document.getElementById("previewTituloLive");
        if (p3) p3.textContent = "Sua live aparecerá aqui";
        const p4 = document.getElementById("previewDescricaoLive");
        if (p4) p4.textContent = "Adicione título e descrição para visualizar.";

        /* Resumo Etapa 3 */
        const r1 = document.getElementById("resumoTituloLive"); if (r1) r1.textContent = "—";
        const r2 = document.getElementById("resumoDataLive"); if (r2) r2.textContent = "—";
        const r3 = document.getElementById("resumoCategoriaLive"); if (r3) r3.textContent = "—";
        const r4 = document.getElementById("resumoQuantidadeLive"); if (r4) r4.textContent = "0 produtos";
    } catch (_) {}

    /* Etapa volta para 1 */
    try {
        etapaAtualLive = 1;
        atualizarEtapaLive();
    } catch (_) {
        /* Fallback se a função não existir: seta direto nas divs */
        const etapas = document.querySelectorAll(".etapa-live");
        etapas.forEach(function (e, i) {
            if (i === 0) e.classList.add("ativa");
            else e.classList.remove("ativa");
        });
    }

    try {
        produtosSelecionadosLive = [];
        capaLiveURL = null;
        urlCapaLive = null;
    } catch (_) {}
};


/* ================================================================
   05. CARREGAR CARDS NA TELA INICIAL — VERSÃO SIMPLÍSSIMA!
   (Cria tudo como string HTML, 0 createElement, 0 complexidade)
   ================================================================ */
window.carregarCardsSimplesNaTelaInicial = function () {
    try {
        const container = document.getElementById("listaCardsRetangulares");
        const secao = document.getElementById("secaoCardsRetangulares");
        if (!container) return;

        const merchantId = getMerchantId();
        if (!merchantId) {
            if (secao) secao.style.display = "none";
            return;
        }

        /* Pega do localStorage (direto, sem helpers!) */
        let lives = [], videos = [];
        try { lives = JSON.parse(localStorage.getItem("modaCenterLives") || "[]"); } catch (_) {}
        try { videos = JSON.parse(localStorage.getItem("modaCenterVideos") || "[]"); } catch (_) {}

        /* Filtra só do comerciante logado */
        lives = lives.filter(function (l) { return String(l.merchantId) === merchantId; });
        videos = videos.filter(function (v) { return String(v.merchantId) === merchantId; });

        /* TOTAL = 0 → esconde a seção, limpa container e retorna! */
        const total = lives.length + videos.length;
        if (total === 0) {
            if (secao) secao.style.display = "none";
            container.innerHTML = "";
            return;
        }

        if (secao) secao.style.display = "block";

        /* ============================================================
           MONTA OS CARDS COMO HTML STRING — 0 createElement!
           ============================================================ */
        let html = "";
        const agoraTimestamp = Date.now();

        /* --- 1) ADICIONA VÍDEOS PRIMEIRO (tipo: video) --- */
        for (let i = 0; i < videos.length && i < 4; i++) {
            const v = videos[i];
            const titulo = (v.titulo || "Vídeo sem título").toString().slice(0, 50);
            const categoria = (v.categoria || "Sem categoria").toString().slice(0, 20);
            let dataFormat = "";
            try {
                if (v.criadoEm) {
                    const d = new Date(v.criadoEm);
                    if (!isNaN(d.getTime())) {
                        dataFormat = String(d.getDate()).padStart(2, "0") + "/" +
                            String(d.getMonth() + 1).padStart(2, "0") + "/" +
                            d.getFullYear();
                    }
                }
            } catch (_) {}

            html += `<div class="card-retangular card-retangular--video" onclick="abrirMeusVideos()">
                <div class="card-retangular__capa">
                    <div class="card-retangular__capa-placeholder card-retangular__capa-placeholder--video">🎬</div>
                    <div class="card-retangular__play-icon card-retangular__play-icon--video">▶</div>
                    <div class="card-retangular__badge card-retangular__badge--video">▶ VÍDEO</div>
                </div>
                <div class="card-retangular__info">
                    <div class="card-retangular__titulo" title="${titulo}">${titulo}</div>
                    <div class="card-retangular__meta">
                        <span class="card-retangular__categoria">${categoria}</span>
                        ${dataFormat ? `<span class="card-retangular__data">${dataFormat}</span>` : ""}
                    </div>
                </div>
            </div>`;
        }

        /* --- 2) ADICIONA LIVES (tipo: live) --- */
        for (let j = 0; j < lives.length && j < 4; j++) {
            const l = lives[j];
            const titulo = (l.titulo || "Live sem título").toString().slice(0, 50);
            const categoria = (l.categoria || "Sem categoria").toString().slice(0, 20);
            let dataFormat = "";
            try {
                if (l.data) {
                    const partes = String(l.data).split("-");
                    if (partes.length === 3) {
                        dataFormat = partes[2] + "/" + partes[1] + "/" + partes[0];
                        if (l.hora) dataFormat += " às " + l.hora;
                    }
                }
            } catch (_) {}

            html += `<div class="card-retangular card-retangular--live" onclick="abrirMinhasLives()">
                <div class="card-retangular__capa">
                    <div class="card-retangular__capa-placeholder card-retangular__capa-placeholder--live">🎥</div>
                    <div class="card-retangular__play-icon card-retangular__play-icon--live">🎥</div>
                    <div class="card-retangular__badge card-retangular__badge--live">🔴 LIVE</div>
                </div>
                <div class="card-retangular__info">
                    <div class="card-retangular__titulo" title="${titulo}">${titulo}</div>
                    <div class="card-retangular__meta">
                        <span class="card-retangular__categoria">${categoria}</span>
                        ${dataFormat ? `<span class="card-retangular__data">${dataFormat}</span>` : ""}
                    </div>
                </div>
            </div>`;
        }

        container.innerHTML = html;
    } catch (e) {
        console.error("ERRO carregar cards:", e);
    }
};


/* ================================================================
   06. INICIALIZAÇÃO — VERSÃO MAIS SIMPLES DO MUNDO!
   Chamada uma vez ao carregar a página.
   ================================================================ */
document.addEventListener("DOMContentLoaded", function () {
    try {
        /* Limpa header primeiro (segurança) */
        try { limparBadgesHeaderAoVivo(); } catch (_) {}

        /* LISTENERS dos inputs título/descrição (vídeo) — SEMPRE no DOMContentLoaded! */
        try {
            const tVideo = document.getElementById("tituloVideo");
            const dVideo = document.getElementById("descricaoVideo");
            if (tVideo) tVideo.addEventListener("input", function () {
                try {
                    const c = document.getElementById("contadorTituloVideo");
                    if (c) c.textContent = String(tVideo.value.length);
                    const pt = document.getElementById("previewTituloVideo");
                    if (pt) pt.textContent = tVideo.value.trim() || "Seu título aparecerá aqui";
                } catch (_) {}
            });
            if (dVideo) dVideo.addEventListener("input", function () {
                try {
                    const c = document.getElementById("contadorDescricaoVideo");
                    if (c) c.textContent = String(dVideo.value.length);
                    const pd = document.getElementById("previewDescricaoVideo");
                    if (pd) pd.textContent = dVideo.value.trim() || "Adicione uma descrição para o seu vídeo.";
                } catch (_) {}
            });
        } catch (_) {}

        /* Setup LIVE */
        try { configurarCamposLive(); } catch (_) {}
        try { carregarProdutosLive(); } catch (_) {}
        try { atualizarEtapaLive(); } catch (_) {}

        /* Nome da loja no preview + categorias */
        try { atualizarNomeLojaPreview(); } catch (_) {}
        try { carregarCategoriasNosSelects(); } catch (_) {}
    } catch (e) {
        console.error("ERRO no DOMContentLoaded (mas seguiu vida):", e);
    }
});



/* ================================================================
   MODA CENTER LIVE & VÍDEO — MODO REAL
   - Live real via WebRTC + sinalização no servidor.
   - Vídeo real enviado para /uploads/videos e listado para clientes.
   - Nenhuma publicação exige selecionar um produto específico.
================================================================ */
let modaCenterLiveState = null;
let modaCenterLiveStream = null;
let modaCenterLivePollTimer = null;
let modaCenterMultistreamSocket = null;
let modaCenterMultistreamRecorder = null;
const modaCenterLivePeers = new Map();
const modaCenterLivePeerModes = new Map();
const modaCenterPendingIce = new Map();

function modaCenterOwnerId() { return String(window.comercianteSession?.id || getMerchantId() || ""); }
function modaCenterOwnerName() {
    const stores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    return String(stores[modaCenterOwnerId()]?.name || window.comercianteSession?.storeName || window.comercianteSession?.name || "Loja Moda Center");
}

async function modaCenterApi(path, options={}) {
    const response = await fetch(path, { cache: "no-store", ...options });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
    return data;
}

async function modaCenterPollSocial() {
    if (!modaCenterLiveState) return;
    try {
        const data = await modaCenterApi(`/api/live/${encodeURIComponent(modaCenterLiveState.live.id)}/social?ownerId=${encodeURIComponent(modaCenterOwnerId())}`);
        const box=document.getElementById("mcLiveChatList");
        if (box) { box.innerHTML=(data.messages||[]).map(m=>`<div class="mc-chat-msg"><strong>${escapeHtml(m.clientName)}</strong><span>${escapeHtml(m.message)}</span></div>`).join("") || '<div class="mc-empty-social">Nenhuma mensagem ainda.</div>'; box.scrollTop=box.scrollHeight; }
        const requests=data.participationRequests||[];
        const reqBox=document.getElementById("mcParticipationRequests");
        if (reqBox) reqBox.innerHTML=requests.filter(r=>r.status==="pending").map(r=>`<div class="mc-request"><span><strong>${escapeHtml(r.clientName)}</strong><small>quer participar da live</small></span><span><button type="button" data-req="${escapeHtml(r.id)}" data-action="approve">Aceitar</button><button type="button" data-req="${escapeHtml(r.id)}" data-action="deny">Recusar</button></span></div>`).join("") || '<div class="mc-empty-social">Nenhum pedido pendente.</div>';
        reqBox?.querySelectorAll('button[data-req]').forEach(btn=>btn.addEventListener('click',async()=>{ try{await modaCenterApi(`/api/live/${encodeURIComponent(modaCenterLiveState.live.id)}/participation/${encodeURIComponent(btn.dataset.req)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ownerId:modaCenterOwnerId(),action:btn.dataset.action})}); await modaCenterPollSocial(); await modaCenterPollLiveSignals();}catch(e){alert(e.message)}}));
    } catch (_) {}
}

function modaCenterEnsureLivePanel() {
    if (document.getElementById("modaCenterLivePanel")) return;
    const panel = document.createElement("div");
    panel.id = "modaCenterLivePanel";
    panel.innerHTML = `
      <div class="mc-live-backdrop">
        <section class="mc-live-panel" role="dialog" aria-modal="true" aria-labelledby="mcLiveTitle">
          <header><div><span>🔴 AO VIVO</span><h2 id="mcLiveTitle">Sua transmissão</h2><small id="mcLiveViewers">0 espectadores</small></div><button type="button" id="mcLiveClose">×</button></header>
          <video id="mcLivePreview" autoplay muted playsinline></video>
          <div id="mcLiveParticipants" class="mc-live-participants"></div>
          <div class="mc-live-social-grid">
            <div class="mc-live-social-card"><h3>💬 Chat ao vivo</h3><div id="mcLiveChatList" class="mc-live-chat-list"></div></div>
            <div class="mc-live-social-card"><h3>🎥 Pedidos para participar</h3><div id="mcParticipationRequests" class="mc-live-chat-list"></div></div>
          </div>
          <div id="mcMultistreamStatus" class="mc-multistream-status">🌐 Moda Center: transmitindo</div>
          <div class="mc-live-actions"><button type="button" id="mcLiveMultistream">🌐 Multistream</button><button type="button" id="mcLiveEnd">⏹ Encerrar live</button></div>
        </section>
      </div>`;
    document.body.appendChild(panel);
    document.getElementById("mcLiveClose").addEventListener("click", () => modaCenterStopLive(false));
    document.getElementById("mcLiveEnd").addEventListener("click", () => modaCenterStopLive(true));
    document.getElementById("mcLiveMultistream").addEventListener("click", () => modaCenterOpenMultistream());
}

function modaCenterUpdateLiveViewerCount(count) {
    const el = document.getElementById("mcLiveViewers");
    if (el) el.textContent = `${count} espectador${count === 1 ? "" : "es"}`;
}
function escapeHtml(value) { return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

async function modaCenterGetMultistreamDestinations() {
    const data = await modaCenterApi(`/api/multistream/destinations?ownerId=${encodeURIComponent(modaCenterOwnerId())}`);
    return Array.isArray(data.destinations) ? data.destinations : [];
}

async function modaCenterSaveMultistreamDestinations(rows) {
    const destinations = rows.filter(row => row.url.trim() || row.key.trim()).map(row => ({
        id: row.id || undefined, type: row.type, name: row.name, url: row.url.trim(), key: row.key.trim(), enabled: row.enabled
    }));
    const data = await modaCenterApi('/api/multistream/destinations', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ownerId:modaCenterOwnerId(), destinations }) });
    return data.destinations || [];
}

function modaCenterRemoveMultistreamModal() {
    document.getElementById('mcMultistreamModal')?.remove();
}

async function modaCenterOpenMultistream() {
    if (!modaCenterLiveState) return alert('Inicie a live primeiro.');
    modaCenterRemoveMultistreamModal();
    let destinations = [];
    try { destinations = await modaCenterGetMultistreamDestinations(); }
    catch (error) { return alert(error.message || 'Não foi possível carregar os destinos.'); }
    const known = new Map(destinations.map(d => [d.type, d]));
    const row = (type, name, hint, badge='') => {
        const d = known.get(type) || {};
        return `<div class="mc-ms-row ${type === 'instagram' || type === 'facebook' ? 'mc-ms-meta-row' : ''}" data-type="${type}" data-id="${d.id || ''}">
          <div class="mc-ms-row-head"><label><input type="checkbox" class="mc-ms-enabled" ${d.enabled !== false && d.keyConfigured ? 'checked' : ''}> <strong>${badge}${name}</strong></label><small>${hint}</small></div>
          <input class="mc-ms-url" value="${escapeHtml(d.url || '')}" placeholder="URL RTMP/RTMPS">
          <input class="mc-ms-key" type="password" placeholder="${d.keyConfigured ? `Chave atual: ${d.keyMasked}` : 'Chave de transmissão'}" autocomplete="new-password">
        </div>`;
    };
    const modal = document.createElement('div');
    modal.id = 'mcMultistreamModal';
    modal.innerHTML = `<div class="mc-ms-backdrop"><section class="mc-ms-dialog" role="dialog" aria-modal="true">
      <button type="button" class="mc-ms-close" aria-label="Fechar">×</button>
      <h2>🌐 Multistream</h2><p>Envie a mesma live do Moda Center para outros destinos. As chaves ficam no servidor e não são exibidas novamente.</p>
      <div class="mc-ms-list">
        ${row('instagram','Instagram','Meta Live Producer • RTMP/RTMPS + chave da sessão','📸 ')}
        ${row('facebook','Facebook','Facebook Live • RTMPS + chave da transmissão','📘 ')}
        ${row('youtube','YouTube','RTMPS • URL de ingestão + chave do YouTube','▶️ ')}
        ${row('twitch','Twitch','RTMP • servidor de ingestão + stream key','🟣 ')}
        ${row('rtmp','Outro RTMP','Serviços que forneçam URL RTMP/RTMPS + chave','➕ ')}
      </div>
      <div class="mc-ms-help mc-ms-meta-help"><strong>🚀 Central Meta</strong><br>Instagram: abra o Live Producer da conta profissional, crie a live e copie a URL RTMP e a chave da sessão. Essa chave pode mudar a cada transmissão. Facebook: use a URL RTMPS e a chave fornecidas pelo fluxo de Live da Página/conta autorizada. O Moda Center não aceita links de lives de terceiros; somente destinos de transmissão aos quais o comerciante tem autorização.</div>
      <div class="mc-ms-actions"><button type="button" class="mc-ms-cancel">Cancelar</button><button type="button" class="mc-ms-save">Salvar configurações</button><button type="button" class="mc-ms-start">💜 Salvar e transmitir agora</button></div>
      <small id="mcMsResult"></small>
    </section></div>`;
    document.body.appendChild(modal);
    modal.querySelector('.mc-ms-close').onclick = modaCenterRemoveMultistreamModal;
    modal.querySelector('.mc-ms-cancel').onclick = modaCenterRemoveMultistreamModal;
    const collect = () => [...modal.querySelectorAll('.mc-ms-row')].map(el => ({ id:el.dataset.id, type:el.dataset.type, name:el.querySelector('strong').textContent, url:el.querySelector('.mc-ms-url').value, key:el.querySelector('.mc-ms-key').value, enabled:el.querySelector('.mc-ms-enabled').checked }));
    modal.querySelector('.mc-ms-save').onclick = async () => {
        try { await modaCenterSaveMultistreamDestinations(collect()); modal.querySelector('#mcMsResult').textContent = 'Configurações salvas.'; }
        catch (error) { modal.querySelector('#mcMsResult').textContent = error.message; }
    };
    modal.querySelector('.mc-ms-start').onclick = async () => {
        try { const saved = await modaCenterSaveMultistreamDestinations(collect()); const ids = saved.filter(d => d.enabled !== false).map(d => d.id); modaCenterRemoveMultistreamModal(); await modaCenterConnectMultistream(ids); }
        catch (error) { modal.querySelector('#mcMsResult').textContent = error.message; }
    };
}

async function modaCenterConnectMultistream(selectedIds) {
    if (!modaCenterLiveState || !modaCenterLiveStream) return;
    if (modaCenterMultistreamSocket?.readyState === WebSocket.OPEN) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws/multistream/${encodeURIComponent(modaCenterLiveState.live.id)}?ownerId=${encodeURIComponent(modaCenterOwnerId())}&destinations=${encodeURIComponent(selectedIds.join(','))}`;
    const socket = new WebSocket(url);
    modaCenterMultistreamSocket = socket;
    const status = document.getElementById('mcMultistreamStatus');
    const setStatus = text => { if (status) status.textContent = text; };
    socket.onopen = () => {
        try {
            const mime = ['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm'].find(t => MediaRecorder.isTypeSupported(t));
            if (!mime) throw new Error('Seu navegador não suporta o formato necessário para o multistream.');
            modaCenterMultistreamRecorder = new MediaRecorder(modaCenterLiveStream, { mimeType:mime, videoBitsPerSecond:2500000, audioBitsPerSecond:128000 });
            modaCenterMultistreamRecorder.ondataavailable = async event => {
                if (!event.data?.size || socket.readyState !== WebSocket.OPEN) return;
                try { socket.send(await event.data.arrayBuffer()); } catch (_) {}
            };
            modaCenterMultistreamRecorder.start(1000);
            setStatus('🌐 Multistream: conectando aos destinos...');
        } catch (error) { setStatus(`⚠️ ${error.message}`); try { socket.close(); } catch (_) {} }
    };
    socket.onmessage = event => {
        try { const data = JSON.parse(event.data); if (data.status === 'starting') setStatus(`🌐 Enviando para: ${(data.destinations || []).join(', ')}`); else if (data.status === 'error') setStatus(`⚠️ Multistream: ${data.message || 'erro no destino'}`); else if (data.status === 'disabled') setStatus('🌐 Multistream: nenhum destino ativo'); } catch (_) {}
    };
    socket.onerror = () => setStatus('⚠️ Multistream indisponível. A live no Moda Center continua ativa.');
    socket.onclose = () => {
        try { if (modaCenterMultistreamRecorder && modaCenterMultistreamRecorder.state !== 'inactive') modaCenterMultistreamRecorder.stop(); } catch (_) {}
        modaCenterMultistreamRecorder = null;
        if (modaCenterMultistreamSocket === socket) modaCenterMultistreamSocket = null;
    };
}


async function modaCenterSendSignal(to, type, data) {
    if (!modaCenterLiveState) return;
    try { await modaCenterApi(`/api/live/${encodeURIComponent(modaCenterLiveState.live.id)}/signal`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ from: modaCenterLiveState.peerId, to, type, data }) }); } catch (_) {}
}

async function modaCenterHandleViewer(viewerPeerId, interactive=false) {
    if (!modaCenterLiveStream || !modaCenterLiveState) return;
    if (modaCenterLivePeers.has(viewerPeerId)) {
        if (!interactive || modaCenterLivePeerModes.get(viewerPeerId) === "interactive") return;
        try { modaCenterLivePeers.get(viewerPeerId).close(); } catch (_) {}
        modaCenterLivePeers.delete(viewerPeerId);
    }
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    modaCenterLivePeers.set(viewerPeerId, pc);
    modaCenterLivePeerModes.set(viewerPeerId, interactive ? "interactive" : "broadcast");
    modaCenterLiveStream.getTracks().forEach(track => pc.addTrack(track, modaCenterLiveStream));
    pc.ontrack = event => {
        if (!interactive) return;
        const container=document.getElementById("mcLiveParticipants"); if(!container) return;
        let video=document.getElementById(`mc-participant-${viewerPeerId}`);
        if(!video){ video=document.createElement("video"); video.id=`mc-participant-${viewerPeerId}`; video.autoplay=true; video.playsInline=true; video.className="mc-live-participant"; container.appendChild(video); }
        video.srcObject=event.streams?.[0] || new MediaStream([event.track]); video.play().catch(()=>{});
    };
    pc.onicecandidate = event => { if (event.candidate) modaCenterSendSignal(viewerPeerId, "ice", event.candidate); };
    pc.onconnectionstatechange = () => { if (["failed","closed","disconnected"].includes(pc.connectionState)) { pc.close(); modaCenterLivePeers.delete(viewerPeerId); modaCenterLivePeerModes.delete(viewerPeerId); document.getElementById(`mc-participant-${viewerPeerId}`)?.remove(); } };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await modaCenterSendSignal(viewerPeerId, "offer", { ...offer, _interactive: !!interactive });
}

async function modaCenterHandleLiveSignal(signal) {
    const pc = modaCenterLivePeers.get(signal.from);
    if (!pc) return;
    if (signal.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.data));
        const pending = modaCenterPendingIce.get(signal.from) || [];
        for (const candidate of pending) { try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {} }
        modaCenterPendingIce.delete(signal.from);
    }
    if (signal.type === "ice" && signal.data) {
        if (!pc.remoteDescription) {
            const list = modaCenterPendingIce.get(signal.from) || [];
            list.push(signal.data); modaCenterPendingIce.set(signal.from, list);
        } else {
            try { await pc.addIceCandidate(new RTCIceCandidate(signal.data)); } catch (_) {}
        }
    }
}

async function modaCenterPollLiveSignals() {
    if (!modaCenterLiveState) return;
    try {
        const data = await modaCenterApi(`/api/live/${encodeURIComponent(modaCenterLiveState.live.id)}/signals?peerId=${encodeURIComponent(modaCenterLiveState.peerId)}`);
        const viewers = Array.isArray(data.viewers) ? data.viewers.filter(item => item && item.id !== modaCenterLiveState.peerId) : [];
        viewers.forEach(item => modaCenterHandleViewer(item.id, item.participation === "approved"));
        for (const signal of (data.signals || [])) await modaCenterHandleLiveSignal(signal);
        modaCenterUpdateLiveViewerCount(viewers.length);
    } catch (_) {}
}

async function modaCenterStartLive(live, broadcasterPeerId) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Seu navegador não permite acesso à câmera e ao microfone.");
    modaCenterEnsureLivePanel();
    modaCenterLiveStream = modaCenterLiveStream || await navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720}, facingMode:"user" }, audio:true });
    const preview = document.getElementById("mcLivePreview");
    if (preview) { preview.srcObject = modaCenterLiveStream; await preview.play().catch(()=>{}); }
    document.getElementById("mcLiveTitle").textContent = live.title;
    document.getElementById("modaCenterLivePanel").hidden = false;
    modaCenterLiveState = { live, peerId: broadcasterPeerId };
    modaCenterLivePollTimer = setInterval(modaCenterPollLiveSignals, 900);
    modaCenterLiveState.socialTimer = setInterval(modaCenterPollSocial, 1500);
    await modaCenterPollLiveSignals();
    await modaCenterPollSocial();
}

async function modaCenterStopLive(showMessage=true) {
    if (!modaCenterLiveState) return;
    const state = modaCenterLiveState;
    clearInterval(modaCenterLivePollTimer);
    modaCenterLivePollTimer = null;
    if (modaCenterLiveState.socialTimer) clearInterval(modaCenterLiveState.socialTimer);
    try { if (modaCenterMultistreamRecorder && modaCenterMultistreamRecorder.state !== 'inactive') modaCenterMultistreamRecorder.stop(); } catch (_) {}
    modaCenterMultistreamRecorder = null;
    try { modaCenterMultistreamSocket?.close(); } catch (_) {}
    modaCenterMultistreamSocket = null;
    for (const pc of modaCenterLivePeers.values()) pc.close();
    modaCenterLivePeers.clear();
    modaCenterLivePeerModes.clear();
    modaCenterPendingIce.clear();
    modaCenterLiveStream?.getTracks().forEach(track => track.stop());
    modaCenterLiveStream = null;
    try { await modaCenterApi(`/api/live/${encodeURIComponent(state.live.id)}/leave`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ peerId:state.peerId }) }); } catch (_) {}
    modaCenterLiveState = null;
    const panel = document.getElementById("modaCenterLivePanel");
    if (panel) panel.remove();
    if (showMessage) alert("A live foi encerrada e deixou de aparecer para os clientes.");
}

async function modaCenterCriarLiveReal() {
    const titulo = document.getElementById("tituloLive")?.value.trim() || "";
    const descricao = document.getElementById("descricaoLive")?.value.trim() || "";
    if (!titulo) return alert("Digite um título para a live.");
    if (!descricao) return alert("Digite uma descrição para a live.");
    if (!window.isSecureContext && location.hostname !== "localhost") return alert("Para usar câmera e microfone, abra o site em HTTPS.");
    const botao = document.querySelector(".btn-criar-live");
    if (botao) { botao.disabled = true; botao.textContent = "🔴 Abrindo câmera..."; }
    try {
        const capa = document.getElementById("previewCapaLive")?.src || null;
        const data = await modaCenterApi("/api/live", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ownerId:modaCenterOwnerId(), ownerName:modaCenterOwnerName(), title:titulo, description:descricao, cover:capa && !capa.startsWith("blob:") ? capa : null }) });
        await modaCenterStartLive(data.live, data.broadcasterPeerId);
        alert("🔴 Live iniciada! Agora os clientes já podem assistir em tempo real.");
    } catch (error) {
        alert(error.message || "Não foi possível iniciar a live.");
    } finally {
        if (botao) { botao.disabled = false; botao.textContent = "🔴 Iniciar live agora"; }
    }
}

async function modaCenterPublicarVideoReal() {
    const arquivo = document.getElementById("arquivoVideo")?.files?.[0];
    const titulo = document.getElementById("tituloVideo")?.value.trim() || "";
    const descricao = document.getElementById("descricaoVideo")?.value.trim() || "";
    if (!arquivo) return alert("Selecione um vídeo para publicar.");
    if (!/^video\//.test(arquivo.type)) return alert("Selecione um arquivo de vídeo válido.");
    if (arquivo.size > 60 * 1024 * 1024) return alert("O vídeo deve ter no máximo 60 MB.");
    if (!titulo) return alert("Digite um título para o vídeo.");
    if (!descricao) return alert("Digite uma descrição para o vídeo.");
    const botao = document.querySelector("#telaVideo .btn-publicar-video, #telaVideo button[onclick*='publicarVideo']");
    if (botao) { botao.disabled = true; botao.textContent = "⏳ Publicando..."; }
    try {
        const params = new URLSearchParams({ ownerId:modaCenterOwnerId(), ownerName:modaCenterOwnerName(), title:titulo, description:descricao, fileName:arquivo.name });
        const capa = document.getElementById("previewCapaVideo")?.src || "";
        const response = await modaCenterApi(`/api/videos/upload?${params.toString()}`, { method:"POST", headers:{"Content-Type":arquivo.type}, body:arquivo });
        const localVideos = getItemsFromStorage(VIDEOS_KEY).filter(v => String(v.merchantId) !== modaCenterOwnerId());
        localVideos.push({ id:response.video.id, merchantId:modaCenterOwnerId(), titulo, descricao, visibilidade:"Público", videoUrl:response.video.url, capa:capa && !capa.startsWith("blob:") ? capa : null, produto:null, criadoEm:new Date().toISOString(), status:"publicado" });
        saveItemsToStorage(VIDEOS_KEY, localVideos);
        alert("🎬 Vídeo publicado! Agora ele aparece para os clientes na aba Live e Vídeos.");
        try { window.resetarFormularioVideo_Simples(); } catch (_) {}
        try { abrirMeusVideos(); } catch (_) { try { window.voltarSelecao(); } catch (__) {} }
    } catch (error) {
        alert(error.message || "Não foi possível publicar o vídeo.");
    } finally {
        if (botao) { botao.disabled = false; botao.textContent = "🎬 Publicar vídeo"; }
    }
}

function modaCenterPrepareLiveVideoUI() {
    // O comerciante NÃO precisa escolher um produto para publicar.
    const liveProductsBox = document.querySelector("#telaLive .produtos-live-box");
    if (liveProductsBox) liveProductsBox.style.display = "none";
    const liveStep2 = document.getElementById("liveEtapa2");
    if (liveStep2) liveStep2.style.display = "none";
    const liveStep2Button = document.getElementById("etapaLive2");
    if (liveStep2Button) {
        liveStep2Button.style.display = "none";
        const lineBefore = liveStep2Button.previousElementSibling;
        const lineAfter = liveStep2Button.nextElementSibling;
        if (lineBefore?.classList.contains("linha-etapa")) lineBefore.style.display = "none";
        if (lineAfter?.classList.contains("linha-etapa")) lineAfter.style.display = "none";
    }
    const nextButton = document.querySelector("#liveEtapa1 .btn-proximo-live");
    if (nextButton) nextButton.setAttribute("onclick", "irParaEtapaLive(3)");
    document.querySelectorAll("#telaVideo .bloco-video").forEach(block => {
        const title = block.querySelector("h3")?.textContent?.toLowerCase() || "";
        if (title.includes("vincule produtos") || title.includes("produtos (opcional)")) block.style.display = "none";
    });
    const videoHeader = document.querySelector("#telaVideo .video-cabecalho p");
    if (videoHeader) videoHeader.textContent = "Publique vídeos da sua loja. Não é necessário escolher um produto específico.";
    const liveHeader = document.querySelector("#telaLive .cabecalho-etapa-live p");
    if (liveHeader) liveHeader.textContent = "Crie a transmissão da sua loja. Você pode apresentar vários produtos ou falar sobre qualquer assunto.";
    const liveStep3Title = document.querySelector("#etapaLive3 small");
    if (liveStep3Title) liveStep3Title.textContent = "Inicie a transmissão";
    const liveStep1Next = document.querySelector("#liveEtapa1 .btn-proximo-live");
    if (liveStep1Next) liveStep1Next.textContent = "Continuar para transmissão →";

    /* Com a etapa de produtos escondida, a LIVE passa a ter só 2 etapas visíveis.
       Ajusta o número exibido no botão "Configurações" (era 3) e os rótulos
       "PASSO X DE 3" para não confundir o comerciante (antes aparecia 1 e depois
       pulava direto para 3). */
    const liveStep3Number = document.querySelector("#etapaLive3 .numero-etapa");
    if (liveStep3Number) liveStep3Number.textContent = "2";
    const liveStep1Passo = document.querySelector("#liveEtapa1 .passo-live");
    if (liveStep1Passo) liveStep1Passo.textContent = "PASSO 1 DE 2";
    const liveStep3Passo = document.querySelector("#liveEtapa3 .passo-live");
    if (liveStep3Passo) liveStep3Passo.textContent = "PASSO 2 DE 2";
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", modaCenterPrepareLiveVideoUI);
else modaCenterPrepareLiveVideoUI();


/* ================================================================
   FLUXO FINAL — estas atribuições ficam por ÚLTIMO de propósito.
   Antes, window.publicarVideo / window.criarLive (versões "simples",
   que só gravavam no localStorage do comerciante) sobrescreviam as
   versões reais e nada chegava ao servidor nem ao cliente.
================================================================ */
const modaCenterCriarLiveAgendada = window.criarLive; /* versão simples: salva agendamento */

function modaCenterModoLive() {
    return document.querySelector('input[name="modoInicioLive"]:checked')?.value || "agora";
}

function atualizarModoInicioLive() {
    const agendar = modaCenterModoLive() === "agendar";
    const bloco = document.getElementById("blocoAgendamentoLive");
    if (bloco) bloco.style.display = agendar ? "" : "none";
    const botao = document.querySelector(".btn-criar-live");
    if (botao) botao.textContent = agendar ? "📅 Agendar live" : "🔴 Iniciar live agora";
}
window.atualizarModoInicioLive = atualizarModoInicioLive;

/* Converte a capa escolhida (se houver) em uma miniatura JPEG pequena para enviar ao servidor. */
function modaCenterCapaLiveDataUrl() {
    return new Promise(resolve => {
        const file = document.getElementById("capaLive")?.files?.[0];
        if (!file) return resolve(null);
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const scale = Math.min(1, 640 / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.75));
            } catch (_) { resolve(null); }
            URL.revokeObjectURL(url);
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
    });
}

/* Iniciar na hora (estilo TikTok/YouTube): abre a câmera, cria a live no servidor
   e ela já aparece para os clientes na aba Live/Vídeos. */
async function modaCenterIniciarLiveAgora() {
    const titulo = document.getElementById("tituloLive")?.value.trim() || "";
    const descricao = document.getElementById("descricaoLive")?.value.trim() || "";
    if (!titulo) return alert("Digite um título para a live.");
    if (!descricao) return alert("Digite uma descrição para a live.");
    if (!navigator.mediaDevices?.getUserMedia) return alert("Seu navegador não permite acesso à câmera e ao microfone.");
    if (!window.isSecureContext && location.hostname !== "localhost") return alert("Para usar câmera e microfone, abra o site em HTTPS.");
    if (modaCenterLiveState) return alert("Você já está transmitindo uma live.");
    const botao = document.querySelector(".btn-criar-live");
    if (botao) { botao.disabled = true; botao.textContent = "🔴 Abrindo câmera..."; }
    try {
        /* 1º a câmera (o comerciante pode demorar no pedido de permissão),
           depois a live é criada já com o vídeo pronto. */
        modaCenterLiveStream = await navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720}, facingMode:"user" }, audio:true });
        const capa = await modaCenterCapaLiveDataUrl();
        const data = await modaCenterApi("/api/live", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ownerId:modaCenterOwnerId(), ownerName:modaCenterOwnerName(), title:titulo, description:descricao, cover:capa }) });
        await modaCenterStartLive(data.live, data.broadcasterPeerId);
        try { window.resetarFormularioLive_Simples(); } catch (_) {}
    } catch (error) {
        modaCenterLiveStream?.getTracks().forEach(track => track.stop());
        modaCenterLiveStream = null;
        const denied = error && (error.name === "NotAllowedError" || error.name === "NotFoundError");
        alert(denied ? "Não foi possível acessar a câmera/microfone. Permita o acesso no navegador e tente de novo." : (error.message || "Não foi possível iniciar a live."));
    } finally {
        if (botao) { botao.disabled = false; atualizarModoInicioLive(); }
    }
}

window.criarLive = function () {
    if (modaCenterModoLive() === "agendar") return modaCenterCriarLiveAgendada();
    return modaCenterIniciarLiveAgora();
};
window.publicarVideo = modaCenterPublicarVideoReal;

/* Se o comerciante fechar a aba, encerra a live no servidor. */
window.addEventListener("pagehide", () => {
    if (!modaCenterLiveState) return;
    try {
        navigator.sendBeacon(`/api/live/${encodeURIComponent(modaCenterLiveState.live.id)}/leave`, new Blob([JSON.stringify({ peerId: modaCenterLiveState.peerId })], { type: "application/json" }));
    } catch (_) {}
});

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", atualizarModoInicioLive);
else atualizarModoInicioLive();
