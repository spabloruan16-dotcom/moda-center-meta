/* ================================================================
   MODA CENTER — LIVE E VÍDEOS (VISÃO DO CLIENTE)
   ---------------------------------------------------------------
   - Lista as lives ativas (WebRTC) e os vídeos publicados pelas lojas.
   - Ao assistir uma live, entra como "viewer" e faz a sinalização
     WebRTC com o comerciante (mesmo protocolo usado em
     Comerciante/js/modacenterliveandvideo.js).
   - Todo erro de rede é tratado e exibido como mensagem amigável —
     nunca deixamos o JSON de erro do servidor aparecer na tela.
================================================================ */

const SESSION_KEY = "modaCenterSession";
const API_ENABLED = window.location.protocol !== "file:";

const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
if (!session || session.profile !== "cliente") {
    window.location.href = "../../index.html?login=1";
}

document.getElementById("clientGreeting").textContent = `Olá, ${session?.name || "cliente"}. Veja quem está ao vivo agora.`;

document.getElementById("clientLogout").addEventListener("click", () => {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "../../index.html?login=1";
});

const noteElement = document.getElementById("liveVideosNote");
const livesGrid = document.getElementById("livesGrid");
const videosGrid = document.getElementById("videosGrid");

function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * Faz uma chamada à API sempre tratando o corpo como JSON e nunca
 * deixando um erro "estourar" como texto cru na tela do usuário.
 */
async function api(path, options = {}) {
    const response = await fetch(path, { cache: "no-store", ...options });
    let data = {};
    try { data = await response.json(); } catch (_) { /* resposta sem corpo JSON */ }
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
    return data;
}

/* ----------------------------------------------------------------
   FILTROS, ABAS E CONTEÚDO
---------------------------------------------------------------- */
const tabTudo = document.getElementById("tabTudo");
const searchInput = document.getElementById("liveVideosSearch");
const storeFilter = document.getElementById("liveVideosStoreFilter");
const clearFiltersButton = document.getElementById("clearLiveVideosFilters");

let todasLives = [];
let todosVideos = [];
let lojasDisponiveis = [];
let filtroTipo = "tudo";

function normalizarTexto(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function atualizarAbas() {
    const estados = { tudo: tabTudo, lives: tabLives, videos: tabVideos };
    Object.entries(estados).forEach(([tipo, botao]) => {
        const ativo = filtroTipo === tipo;
        botao.classList.toggle("ativa", ativo);
        botao.setAttribute("aria-selected", String(ativo));
    });
}

function mostrarAba(aba) {
    filtroTipo = aba;
    atualizarAbas();
    aplicarFiltros();
}

tabTudo.addEventListener("click", () => mostrarAba("tudo"));
tabLives.addEventListener("click", () => mostrarAba("lives"));
tabVideos.addEventListener("click", () => mostrarAba("videos"));

function obterTermoBusca() {
    return normalizarTexto(searchInput.value);
}

function correspondeFiltro(item, tipo) {
    const termo = obterTermoBusca();
    const lojaSelecionada = String(storeFilter.value || "");
    const ownerId = String(item.ownerId || "");
    const texto = normalizarTexto([
        item.title, item.titulo, item.description, item.descricao,
        item.ownerName, item.storeName, item.name
    ].join(" "));

    const lojaOk = !lojaSelecionada || ownerId === lojaSelecionada;
    const buscaOk = !termo || texto.includes(termo);
    return lojaOk && buscaOk;
}

function aplicarFiltros() {
    const lives = todasLives.filter(live => correspondeFiltro(live, "live"));
    const videos = todosVideos.filter(video => correspondeFiltro(video, "video"));

    if (filtroTipo === "lives") {
        livesGrid.hidden = false;
        videosGrid.hidden = true;
        renderLives(lives);
    } else if (filtroTipo === "videos") {
        livesGrid.hidden = true;
        videosGrid.hidden = false;
        renderVideos(videos);
    } else {
        livesGrid.hidden = false;
        videosGrid.hidden = false;
        renderLives(lives);
        renderVideos(videos);
    }

    const total = lives.length + videos.length;
    const termo = searchInput.value.trim();
    const loja = storeFilter.options[storeFilter.selectedIndex]?.textContent || "";
    if (termo || storeFilter.value) {
        noteElement.textContent = `${total} resultado${total === 1 ? "" : "s"}${termo ? ` para “${termo}”` : ""}${storeFilter.value ? ` • ${loja}` : ""}.`;
    } else {
        noteElement.textContent = "";
    }
}

function preencherFiltroLojas() {
    const mapa = new Map();
    lojasDisponiveis.forEach(store => {
        const id = String(store.id || store.ownerId || "");
        const name = String(store.name || store.ownerName || "").trim();
        if (id && name) mapa.set(id, name);
    });
    [...todasLives, ...todosVideos].forEach(item => {
        const id = String(item.ownerId || "");
        const name = String(item.ownerName || "").trim();
        if (id && name && !mapa.has(id)) mapa.set(id, name);
    });

    const atual = String(storeFilter.value || "");
    storeFilter.innerHTML = '<option value="">Todas as lojas</option>';
    [...mapa.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], "pt-BR", { sensitivity: "base" }))
        .forEach(([id, name]) => {
            const option = document.createElement("option");
            option.value = id;
            option.textContent = name;
            storeFilter.appendChild(option);
        });
    if ([...storeFilter.options].some(option => option.value === atual)) storeFilter.value = atual;
}

async function carregarLojas() {
    if (!API_ENABLED) return;
    try {
        const data = await api("/api/catalog");
        const stores = data.stores || {};
        lojasDisponiveis = Object.entries(stores).map(([id, store]) => ({ id, ...(store || {}) }));
        preencherFiltroLojas();
    } catch (_) {
        // O filtro ainda funciona com as lojas que aparecem nas lives/vídeos.
    }
}

async function carregarLives() {
    if (!API_ENABLED) { livesGrid.innerHTML = `<div class="empty-state">Abra o site pelo servidor para ver as lives.</div>`; return; }
    try {
        const data = await api("/api/live");
        todasLives = Array.isArray(data.lives) ? data.lives : [];
        preencherFiltroLojas();
        aplicarFiltros();
    } catch (error) {
        livesGrid.innerHTML = `<div class="empty-state">Não foi possível carregar as lives agora. Tente novamente em instantes.</div>`;
    }
}

function renderLives(lives) {
    if (!lives.length) {
        livesGrid.innerHTML = `<div class="empty-state">Nenhuma live encontrada com esses filtros.</div>`;
        return;
    }
    livesGrid.innerHTML = lives.map(live => `
        <button type="button" class="lv-card" data-live-id="${escapeHtml(live.id)}">
            <div class="lv-card-thumb">
                <span class="lv-card-badge">🔴 AO VIVO</span>
                <span class="lv-card-viewers">${Number(live.viewers || 0)} assistindo</span>
                ${live.cover ? `<img src="${escapeHtml(live.cover)}" alt="Capa da live">` : `<span class="lv-card-play">▶</span>`}
            </div>
            <div class="lv-card-body">
                <strong>${escapeHtml(live.title)}</strong>
                <p class="store-name">${escapeHtml(live.ownerName || "Loja Moda Center")}</p>
                <p>${escapeHtml(live.description || "")}</p>
            </div>
        </button>
    `).join("");
    livesGrid.querySelectorAll(".lv-card").forEach(card => {
        card.addEventListener("click", () => {
            const live = lives.find(item => String(item.id) === card.dataset.liveId);
            if (live) assistirLive(live);
        });
    });
}

async function carregarVideos() {
    if (!API_ENABLED) { videosGrid.innerHTML = `<div class="empty-state">Abra o site pelo servidor para ver os vídeos.</div>`; return; }
    try {
        const data = await api("/api/videos");
        todosVideos = Array.isArray(data.videos) ? data.videos : [];
        preencherFiltroLojas();
        aplicarFiltros();
    } catch (error) {
        videosGrid.innerHTML = `<div class="empty-state">Não foi possível carregar as publicações agora. Tente novamente em instantes.</div>`;
    }
}

function renderVideos(videos) {
    if (!videos.length) {
        videosGrid.innerHTML = `<div class="empty-state">Nenhuma publicação encontrada com esses filtros.</div>`;
        return;
    }
    videosGrid.innerHTML = videos.map(video => `
        <button type="button" class="lv-card" data-video-id="${escapeHtml(video.id)}">
            <div class="lv-card-thumb">
                <span class="lv-card-badge lv-badge-video">🎬 PUBLICAÇÃO</span>
                ${video.capa ? `<img src="${escapeHtml(video.capa)}" alt="Capa do vídeo">` : `<video src="${escapeHtml(video.url || video.videoUrl || "")}#t=0.5" preload="metadata" muted playsinline></video><span class="lv-card-play">▶</span>`}
            </div>
            <div class="lv-card-body">
                <strong>${escapeHtml(video.title || video.titulo)}</strong>
                <p class="store-name">${escapeHtml(video.ownerName || "Loja Moda Center")}</p>
                <p>${escapeHtml(video.description || video.descricao || "")}</p>
                <div class="lv-card-social"><span>❤️ ${Number(video.likeCount || 0)}</span><span>💬 ${Number(video.commentCount || 0)}</span><span>↗ ${Number(video.shareCount || 0)}</span></div>
            </div>
        </button>
    `).join("");
    videosGrid.querySelectorAll(".lv-card").forEach(card => {
        card.addEventListener("click", () => {
            const video = videos.find(item => String(item.id) === card.dataset.videoId);
            if (video) assistirVideo(video);
        });
    });
}

searchInput.addEventListener("input", aplicarFiltros);
storeFilter.addEventListener("change", aplicarFiltros);
clearFiltersButton.addEventListener("click", () => {
    searchInput.value = "";
    storeFilter.value = "";
    filtroTipo = "tudo";
    atualizarAbas();
    aplicarFiltros();
    searchInput.focus();
});

/* ----------------------------------------------------------------
   ASSISTIR VÍDEO (arquivo já publicado)
---------------------------------------------------------------- */
const videoWatchModal = document.getElementById("videoWatchModal");
const videoWatchVideo = document.getElementById("videoWatchVideo");
let currentVideoSocial = null;
let currentLiveSocial = null;
let socialPollTimer = null;

function clientId() { return String(session?.id || session?.userId || session?.email || "cliente"); }
function clientName() { return String(session?.name || session?.nome || "Cliente"); }
async function carregarVideoSocial(videoId) {
    try {
        const data = await api(`/api/videos/${encodeURIComponent(videoId)}/social`);
        const likeBtn=document.getElementById("videoLikeBtn"), shareBtn=document.getElementById("videoShareBtn"), comments=document.getElementById("videoCommentsList");
        if (likeBtn) { likeBtn.textContent=`❤️ Curtir (${Number(data.likes||0)})`; likeBtn.dataset.liked = data.liked ? "1":"0"; }
        if (shareBtn) shareBtn.textContent=`↗ Compartilhar (${Number(data.shares||0)})`;
        if (comments) comments.innerHTML=(data.comments||[]).map(c=>`<div class="lv-comment"><strong>${escapeHtml(c.clientName)}</strong><span>${escapeHtml(c.message)}</span></div>`).join("") || '<div class="lv-empty-social">Ainda não há comentários.</div>';
    } catch (_) {}
}


function assistirVideo(video) {
    currentVideoSocial = video;
    document.getElementById("videoWatchTitle").textContent = video.title || video.titulo || "Vídeo";
    document.getElementById("videoWatchStore").textContent = video.ownerName || "Loja Moda Center";
    document.getElementById("videoWatchDescription").textContent = video.description || video.descricao || "";
    videoWatchVideo.src = video.url || video.videoUrl || "";
    videoWatchModal.hidden = false;
    videoWatchVideo.play().catch(() => {});
    carregarVideoSocial(video.id);
}

function fecharVideoWatch() {
    videoWatchVideo.pause();
    videoWatchVideo.removeAttribute("src");
    videoWatchVideo.load();
    videoWatchModal.hidden = true;
}
document.getElementById("closeVideoWatch").addEventListener("click", fecharVideoWatch);

/* ----------------------------------------------------------------
   ASSISTIR LIVE (visualizador WebRTC)
   Mesmo protocolo de sinalização usado pelo comerciante:
   /api/live/:id/join, /api/live/:id/signal, /api/live/:id/signals,
   /api/live/:id/leave.
---------------------------------------------------------------- */
const liveWatchModal = document.getElementById("liveWatchModal");
const liveWatchVideo = document.getElementById("liveWatchVideo");
const liveWatchStatus = document.getElementById("liveWatchStatus");
const liveWatchUnmute = document.getElementById("liveWatchUnmute");

let viewerState = null;
let viewerPc = null;
let viewerPollTimer = null;
let viewerPolling = false;
let viewerPendingIce = [];

function mostrarStatusLive(mensagem) {
    if (!mensagem) { liveWatchStatus.hidden = true; return; }
    liveWatchStatus.hidden = false;
    liveWatchStatus.textContent = mensagem;
}

async function carregarLiveSocial() {
    if (!viewerState) return;
    try {
        const data = await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/social?since=0&peerId=${encodeURIComponent(viewerState.peerId)}`);
        const chat=document.getElementById("liveChatList");
        if (chat) { chat.innerHTML=(data.messages||[]).map(m=>`<div class="lv-chat-msg"><strong>${escapeHtml(m.clientName)}</strong><span>${escapeHtml(m.message)}</span></div>`).join("") || '<div class="lv-empty-social">Seja o primeiro a comentar.</div>'; chat.scrollTop=chat.scrollHeight; }
        const requestBtn=document.getElementById("liveParticipationBtn");
        const mine=(data.participationRequests||[]).find(r=>String(r.clientId)===String(viewerState.peerId));
        if (requestBtn) { requestBtn.disabled=!!mine && ["pending","approved"].includes(mine.status); requestBtn.textContent=mine?.status==="approved"?"✅ Participação aprovada":mine?.status==="pending"?"⏳ Pedido enviado":"🎥 Pedir para participar"; }
    } catch (_) {}
}
async function enviarChatLive() {
    const input=document.getElementById("liveChatInput"); const message=String(input?.value||"").trim();
    if (!message || !viewerState) return;
    try { await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/social`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"chat",clientId:clientId(),clientName:clientName(),message})}); input.value=""; await carregarLiveSocial(); } catch(e) { mostrarStatusLive(e.message); }
}
async function pedirParticipacaoLive() {
    if (!viewerState) return;
    try { await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/social`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"participation",clientId:viewerState.peerId,clientName:clientName()})}); await carregarLiveSocial(); } catch(e) { mostrarStatusLive(e.message); }
}

async function assistirLive(live) {
    document.getElementById("liveWatchTitle").textContent = live.title;
    document.getElementById("liveWatchStore").textContent = live.ownerName || "Loja Moda Center";
    document.getElementById("liveWatchDescription").textContent = live.description || "";
    liveWatchVideo.srcObject = null;
    liveWatchVideo.muted = false;
    liveWatchVideo.volume = 1;
    if (liveWatchUnmute) liveWatchUnmute.hidden = true;
    liveWatchModal.hidden = false;
    mostrarStatusLive("Conectando à transmissão...");

    try {
        const data = await api(`/api/live/${encodeURIComponent(live.id)}/join`, { method: "POST" });
        viewerState = { liveId: live.id, peerId: data.peerId, broadcasterPeerId: data.broadcasterPeerId };
        viewerPollTimer = setInterval(pollSignals, 900);
        socialPollTimer = setInterval(carregarLiveSocial, 1500);
        await pollSignals();
        await carregarLiveSocial();
    } catch (error) {
        mostrarStatusLive(error.message || "Essa live não está mais disponível.");
    }
}

async function pollSignals() {
    /* Evita polls sobrepostos: senão um candidato ICE podia ser processado antes da oferta. */
    if (!viewerState || viewerPolling) return;
    viewerPolling = true;
    try {
        const data = await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/signals?peerId=${encodeURIComponent(viewerState.peerId)}`);
        for (const signal of (data.signals || [])) await handleSignal(signal);
    } catch (error) {
        mostrarStatusLive("A transmissão foi encerrada.");
        pararAssistirLive(false);
    } finally {
        viewerPolling = false;
    }
}

async function handleSignal(signal) {
    if (!viewerState || signal.from !== viewerState.broadcasterPeerId) return;

    if (signal.type === "offer") {
        if (viewerPc) { try { viewerPc.close(); } catch (_) {} }
        viewerPc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        viewerPc.ontrack = event => {
            const stream = event.streams?.[0] || new MediaStream([event.track]);
            liveWatchVideo.srcObject = stream;
            liveWatchVideo.muted = false;
            liveWatchVideo.volume = 1;
            mostrarStatusLive(null);
            liveWatchVideo.play().then(() => {
                if (liveWatchUnmute) liveWatchUnmute.hidden = true;
            }).catch(() => {
                /* A política de autoplay pode bloquear o som. O cliente recebe um botão explícito. */
                if (liveWatchUnmute) liveWatchUnmute.hidden = false;
            });
        };
        viewerPc.onicecandidate = event => { if (event.candidate) enviarSinal("ice", event.candidate); };
        viewerPc.onconnectionstatechange = () => {
            if (viewerPc && ["failed", "closed", "disconnected"].includes(viewerPc.connectionState)) {
                mostrarStatusLive("A conexão com a transmissão caiu.");
            }
        };
        try {
            if (signal.data?._interactive) {
                if (!navigator.mediaDevices?.getUserMedia) throw new Error("Seu navegador não permite câmera/microfone.");
                if (!viewerState.participantStream) viewerState.participantStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:true});
                viewerState.participantStream.getTracks().forEach(track => viewerPc.addTrack(track, viewerState.participantStream));
                mostrarStatusLive("🎥 Você entrou na transmissão.");
            }
            const remoteOffer = { ...signal.data }; delete remoteOffer._interactive;
            await viewerPc.setRemoteDescription(new RTCSessionDescription(remoteOffer));
            for (const candidate of viewerPendingIce) { try { await viewerPc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {} }
            viewerPendingIce = [];
            const answer = await viewerPc.createAnswer();
            await viewerPc.setLocalDescription(answer);
            await enviarSinal("answer", answer);
        } catch (_) { mostrarStatusLive("Não foi possível conectar à transmissão."); }
    }

    if (signal.type === "ice" && signal.data) {
        if (!viewerPc || !viewerPc.remoteDescription) { viewerPendingIce.push(signal.data); return; }
        try { await viewerPc.addIceCandidate(new RTCIceCandidate(signal.data)); } catch (_) { /* ignora candidato inválido */ }
    }
}

async function enviarSinal(type, data) {
    if (!viewerState) return;
    try {
        await api(`/api/live/${encodeURIComponent(viewerState.liveId)}/signal`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from: viewerState.peerId, to: viewerState.broadcasterPeerId, type, data })
        });
    } catch (_) { /* sinal perdido: o próximo polling tenta de novo */ }
}

function pararAssistirLive(avisarServidor = true) {
    clearInterval(viewerPollTimer);
    viewerPollTimer = null;
    clearInterval(socialPollTimer);
    socialPollTimer = null;
    if (viewerPc) { viewerPc.close(); viewerPc = null; }
    viewerState?.participantStream?.getTracks().forEach(track => track.stop());
    viewerPendingIce = [];
    liveWatchVideo.muted = false;
    liveWatchVideo.volume = 1;
    if (liveWatchUnmute) liveWatchUnmute.hidden = true;
    liveWatchVideo.srcObject = null;
    if (viewerState && avisarServidor) {
        api(`/api/live/${encodeURIComponent(viewerState.liveId)}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peerId: viewerState.peerId })
        }).catch(() => {});
    }
    viewerState = null;
}

liveWatchUnmute?.addEventListener("click", async () => {
    try {
        liveWatchVideo.muted = false;
        liveWatchVideo.volume = 1;
        await liveWatchVideo.play();
        liveWatchUnmute.hidden = true;
        mostrarStatusLive(null);
    } catch (_) {
        mostrarStatusLive("Clique novamente em “Ativar som” para liberar o áudio.");
    }
});

document.getElementById("closeLiveWatch").addEventListener("click", () => {
    pararAssistirLive(true);
    liveWatchModal.hidden = true;
});

window.addEventListener("pagehide", () => {
    if (!viewerState) return;
    try { navigator.sendBeacon(`/api/live/${encodeURIComponent(viewerState.liveId)}/leave`, new Blob([JSON.stringify({ peerId: viewerState.peerId })], { type: "application/json" })); } catch (_) {}
});

/* ----------------------------------------------------------------
   INICIALIZAÇÃO
---------------------------------------------------------------- */
carregarLojas();
carregarLives();
carregarVideos();
if (API_ENABLED) window.setInterval(() => { if (!liveWatchModal.hidden) return; carregarLives(); }, 6000);
if (API_ENABLED) window.setInterval(() => { if (!videoWatchModal.hidden) return; carregarVideos(); }, 15000);


/* Interações sociais */
document.getElementById("liveChatSend")?.addEventListener("click", enviarChatLive);
document.getElementById("liveChatInput")?.addEventListener("keydown", e => { if (e.key === "Enter") enviarChatLive(); });
document.getElementById("liveParticipationBtn")?.addEventListener("click", pedirParticipacaoLive);
document.getElementById("videoLikeBtn")?.addEventListener("click", async () => { if (!currentVideoSocial) return; const d=await api(`/api/videos/${encodeURIComponent(currentVideoSocial.id)}/like`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:clientId(),clientName:clientName()})}); document.getElementById("videoLikeBtn").textContent=`❤️ Curtir (${d.likes})`; });
document.getElementById("videoShareBtn")?.addEventListener("click", async () => { if (!currentVideoSocial) return; const d=await api(`/api/videos/${encodeURIComponent(currentVideoSocial.id)}/share`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:clientId(),clientName:clientName()})}); try { await navigator.share?.({title:currentVideoSocial.title,url:location.href}); } catch(_) {} document.getElementById("videoShareBtn").textContent=`↗ Compartilhar (${d.shares})`; });
document.getElementById("videoCommentSend")?.addEventListener("click", async () => { if (!currentVideoSocial) return; const input=document.getElementById("videoCommentInput"), message=String(input?.value||"").trim(); if(!message)return; await api(`/api/videos/${encodeURIComponent(currentVideoSocial.id)}/comments`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({clientId:clientId(),clientName:clientName(),message})}); input.value=""; carregarVideoSocial(currentVideoSocial.id); });
const originalAssistirLive = assistirLive;
const oldCloseLive = document.getElementById("closeLiveWatch");
oldCloseLive?.addEventListener("click",()=>{ clearInterval(socialPollTimer); socialPollTimer=null; });
