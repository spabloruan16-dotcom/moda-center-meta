// =========================================================
// PERFIL DO COMERCIANTE (perfil_comerciante.html)
// =========================================================
// Personaliza o perfil com a sessao local e controla as acoes
// da tela: configuracoes, logout e navegacao inferior.

// Recupera os dados salvos pelo fluxo de login.
// A sessão já foi lida e validada por Comerciante/js/comerciante-guard.js (carregado
// antes deste arquivo no HTML), então só reaproveitamos o resultado
// em vez de ler o localStorage de novo.
const session = window.comercianteSession;
const displayName = session?.email === "admin" ? "Teste" : (session?.name || "Jhon Smit");
const formattedName = String(displayName).trim().replace(/^./, character => character.toUpperCase());
const initials = formattedName.split(/\s+/).map(part => part.charAt(0)).slice(0, 2).join("").toUpperCase();

const profileViewName = document.getElementById("profileViewName");
const profileInitials = document.getElementById("profileInitials");
const profileStoreName = document.getElementById("profileStoreName");
const profileAverageRating = document.getElementById("profileAverageRating");
const profileReviewsCount = document.getElementById("profileReviewsCount");
const profileSalesCount = document.getElementById("profileSalesCount");
const profileStatAverageRating = document.getElementById("profileStatAverageRating");
const profileStatReviewsCount = document.getElementById("profileStatReviewsCount");
const settingsName = document.getElementById("settingsName");
const settingsInitials = document.getElementById("settingsInitials");
const settingsBackdrop = document.getElementById("settingsBackdrop");
const profileAvatarImage = document.getElementById("profileAvatarImage");
const profileEditBackdrop = document.getElementById("profileEditBackdrop");
const profileEditForm = document.getElementById("profileEditForm");
const editProfileName = document.getElementById("editProfileName");
const editProfileEmail = document.getElementById("editProfileEmail");
const editStoreName = document.getElementById("editStoreName");
const editStoreSector = document.getElementById("editStoreSector");
const editStoreStreet = document.getElementById("editStoreStreet");
const editStoreBox = document.getElementById("editStoreBox");
const editProfileImage = document.getElementById("editProfileImage");
const profileEditPreview = document.getElementById("profileEditPreview");
const editStoreImage = document.getElementById("editStoreImage");
const storeEditPreview = document.getElementById("storeEditPreview");
const profileEditNote = document.getElementById("profileEditNote");
const insightsBackdrop = document.getElementById("insightsBackdrop");
const insightsContent = document.getElementById("insightsContent");
const insightsTitle = document.getElementById("insightsTitle");
let pendingProfileImage = session?.avatar || "";
let pendingStoreImage = "";

// Atualiza nome e iniciais nos dois pontos em que a conta aparece.
if (profileViewName) profileViewName.textContent = formattedName;
if (profileInitials) profileInitials.textContent = initials;
if (settingsName) settingsName.textContent = formattedName;
if (settingsInitials) settingsInitials.textContent = initials;

// Mostra o nome da loja cadastrado em cadastro-loja.html (primeiro
// acesso do comerciante), guardado em "modaCenterStores".
const stores = JSON.parse(localStorage.getItem("modaCenterStores") || "{}");
const myStore = stores[session?.id];

if (profileStoreName && myStore?.name) {
	profileStoreName.textContent = myStore.name;
}

// Mostra a quantidade real de produtos cadastrados por este
// comerciante (ver produto-novo.html), no lugar do número fixo de
// exemplo que existia aqui antes.
const allProducts = JSON.parse(localStorage.getItem("modaCenterProducts") || "{}");
const profileProductsCount = document.getElementById("profileProductsCount");

if (profileProductsCount) {
	profileProductsCount.textContent = (allProducts[session?.id] || []).length;
}

const myProducts = allProducts[session?.id] || [];
const salesCount = myProducts.reduce((total, product) => total + Number(product.salesCount || 0), 0);
const ratings = myProducts.flatMap(product => Array.isArray(product.ratings) ? product.ratings : []);
const averageRating = ratings.length
    ? ratings.reduce((total, rating) => total + Number(rating.value || 0), 0) / ratings.length
    : 0;
const formattedRating = averageRating.toFixed(2).replace(".", ",");

if (profileSalesCount) profileSalesCount.textContent = salesCount.toLocaleString("pt-BR");
if (profileAverageRating) profileAverageRating.textContent = formattedRating;
if (profileStatAverageRating) profileStatAverageRating.textContent = formattedRating;
if (profileReviewsCount) profileReviewsCount.textContent = ratings.length;
if (profileStatReviewsCount) profileStatReviewsCount.textContent = ratings.length;

async function refreshProfileMetricsFromServer() {
    if (window.location.protocol === "file:") return;
    try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const remoteProducts = (data.products || []).filter(product => String(product.ownerId) === String(session?.id));
        const remoteRatings = remoteProducts.flatMap(product => Array.isArray(product.ratings) ? product.ratings : []);
        const remoteSales = remoteProducts.reduce((total, product) => total + Number(product.salesCount || 0), 0);
        const remoteAverage = remoteRatings.length ? remoteRatings.reduce((total, rating) => total + Number(rating.value || 0), 0) / remoteRatings.length : 0;
        const remoteFormattedRating = remoteAverage.toFixed(2).replace(".", ",");
        if (profileProductsCount) profileProductsCount.textContent = remoteProducts.length;
        if (profileSalesCount) profileSalesCount.textContent = remoteSales.toLocaleString("pt-BR");
        if (profileAverageRating) profileAverageRating.textContent = remoteFormattedRating;
        if (profileStatAverageRating) profileStatAverageRating.textContent = remoteFormattedRating;
        if (profileReviewsCount) profileReviewsCount.textContent = remoteRatings.length;
        if (profileStatReviewsCount) profileStatReviewsCount.textContent = remoteRatings.length;
    } catch (error) {
        // Mantém os dados locais já renderizados quando a API estiver indisponível.
    }
}

void refreshProfileMetricsFromServer();

function updateProfileAvatar(image) {
    if (image) {
        profileInitials.hidden = true;
        profileAvatarImage.src = image;
        profileAvatarImage.hidden = false;
        settingsInitials.textContent = "";
        settingsInitials.style.backgroundImage = `url("${image}")`;
        settingsInitials.classList.add("has-image");
    } else {
        profileInitials.hidden = false;
        profileAvatarImage.hidden = true;
        settingsInitials.textContent = initials;
        settingsInitials.style.backgroundImage = "";
        settingsInitials.classList.remove("has-image");
    }
}

updateProfileAvatar(pendingProfileImage);

function openProfileEditor() {
    const currentUser = JSON.parse(localStorage.getItem("modaCenterUsers") || "[]")
        .find(user => String(user.id) === String(session?.id)) || session;
    const currentStore = stores[session?.id] || {};

    editProfileName.value = currentUser?.name || "";
    editProfileEmail.value = currentUser?.email || "";
    editStoreName.value = currentStore.name || "";
    editStoreSector.value = currentStore.location?.sector || "";
    editStoreStreet.value = currentStore.location?.street || "";
    editStoreBox.value = currentStore.location?.box || "";
    pendingStoreImage = currentStore.image || "";
    profileEditForm.querySelectorAll('input[name="segment"]').forEach(input => {
        input.checked = (currentStore.segments || []).includes(input.value);
    });
    editProfileImage.value = "";
    editStoreImage.value = "";
    profileEditNote.textContent = "";
    if (pendingProfileImage) {
        profileEditPreview.src = pendingProfileImage;
        profileEditPreview.hidden = false;
    } else {
        profileEditPreview.hidden = true;
    }
    if (pendingStoreImage) {
        storeEditPreview.src = pendingStoreImage;
        storeEditPreview.hidden = false;
    } else {
        storeEditPreview.hidden = true;
    }
    profileEditBackdrop.classList.add("open");
    profileEditBackdrop.setAttribute("aria-hidden", "false");
}

function closeProfileEditor() {
    profileEditBackdrop.classList.remove("open");
    profileEditBackdrop.setAttribute("aria-hidden", "true");
}

// Abre e fecha o painel de configuracoes sem trocar de pagina.
document.getElementById("profileSettingsButton")?.addEventListener("click", () => {
    settingsBackdrop?.classList.add("open");
    settingsBackdrop?.setAttribute("aria-hidden", "false");
});

function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function money(value) { return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`; }
function openInsights(title, content) { insightsTitle.textContent = title; insightsContent.innerHTML = content; insightsBackdrop.hidden = false; }
function closeInsights() { insightsBackdrop.hidden = true; }

function renderReports(orders = []) {
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const sold = orders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
    const stock = myProducts.reduce((sum, product) => sum + Number(product.quantity || 0), 0);
    const entered = stock + sold;
    openInsights("Relatórios", `<div class="report-grid"><article><strong>${orders.length}</strong><span>Pedidos recebidos</span></article><article><strong>${sold}</strong><span>Itens vendidos</span></article><article><strong>${money(totalRevenue)}</strong><span>Faturamento</span></article><article><strong>${stock}</strong><span>Estoque atual</span></article><article><strong>${entered}</strong><span>Itens cadastrados</span></article><article><strong>${Math.max(0, entered - stock)}</strong><span>Itens que saíram</span></article></div><p class="insight-note">Atualizado com os produtos da loja e os pedidos registrados.</p>`);
}

function renderReviews() {
    const products = myProducts;
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
    openInsights("Minhas avaliações", `<div class="insight-filters"><select id="reviewProductFilter"><option value="all">Todos os produtos</option>${products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`).join("")}</select><select id="reviewCategoryFilter"><option value="all">Todas as categorias</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}</select></div><div id="reviewsList"></div>`);
    const draw = () => {
        const productFilter = document.getElementById("reviewProductFilter").value;
        const categoryFilter = document.getElementById("reviewCategoryFilter").value;
        const reviews = products.flatMap(product => (Array.isArray(product.ratings) ? product.ratings : []).map(rating => ({ ...rating, productName: product.name, productId: product.id, category: product.category }))).filter(rating => (productFilter === "all" || String(rating.productId) === productFilter) && (categoryFilter === "all" || rating.category === categoryFilter));
        document.getElementById("reviewsList").innerHTML = reviews.length ? reviews.map(rating => `<article class="review-item"><strong>${"★".repeat(Math.max(1, Number(rating.value || 0)))}${"☆".repeat(Math.max(0, 5 - Number(rating.value || 0)))}</strong><span>${escapeHtml(rating.productName)} · ${escapeHtml(rating.category)}</span><p>${escapeHtml(rating.comment || "Cliente avaliou este produto.")}</p></article>`).join("") : '<p class="insight-note">Nenhuma avaliação encontrada com esses filtros.</p>';
    };
    document.getElementById("reviewProductFilter").addEventListener("change", draw);
    document.getElementById("reviewCategoryFilter").addEventListener("change", draw);
    draw();
}

async function renderLatestOrders() {
    openInsights("Últimas vendas", '<p class="insight-note">Carregando pedidos...</p>');
    let orders = [];
    if (window.location.protocol !== "file:") { try { const response = await fetch(`/api/orders?merchantId=${encodeURIComponent(session.id)}`, { cache: "no-store" }); if (response.ok) orders = (await response.json()).orders || []; } catch (error) {} }
    const visibleOrders = orders.filter(order => !["enviado", "entregue"].includes(order.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    insightsContent.innerHTML = visibleOrders.length ? `<div class="latest-orders">${visibleOrders.map(order => `<article><div><strong>Pedido #${escapeHtml(order.id.slice(0, 8).toUpperCase())}</strong><small>${new Date(order.createdAt).toLocaleString("pt-BR")}</small></div><span class="order-pill status-${escapeHtml(order.status)}">${({ recebido: "Recebido", preparando: "Preparando", postado: "Postado" })[order.status] || escapeHtml(order.status)}</span><p>${(order.items || []).length} item(ns) · ${money(order.total)}</p></article>`).join("")}</div><a class="insight-link" href="pedidos_comerciante.html">Gerenciar todos os pedidos</a>` : '<p class="insight-note">Nenhuma venda pendente. Quando o pedido for enviado para entrega, ele sai desta lista.</p>';
}

document.getElementById("reportsButton")?.addEventListener("click", async () => { let orders = []; if (window.location.protocol !== "file:") { try { const response = await fetch(`/api/orders?merchantId=${encodeURIComponent(session.id)}`, { cache: "no-store" }); if (response.ok) orders = (await response.json()).orders || []; } catch (error) {} } renderReports(orders); });
document.getElementById("reviewsButton")?.addEventListener("click", renderReviews);
document.getElementById("latestOrdersButton")?.addEventListener("click", renderLatestOrders);
document.getElementById("insightsClose")?.addEventListener("click", closeInsights);
insightsBackdrop?.addEventListener("click", event => { if (event.target === insightsBackdrop) closeInsights(); });

document.getElementById("settingsClose")?.addEventListener("click", () => {
    settingsBackdrop?.classList.remove("open");
    settingsBackdrop?.setAttribute("aria-hidden", "true");
});

document.getElementById("editProfileButton")?.addEventListener("click", openProfileEditor);
document.getElementById("profileEditHeroButton")?.addEventListener("click", openProfileEditor);
document.querySelector(".profile-camera")?.addEventListener("click", openProfileEditor);
document.getElementById("profileEditClose")?.addEventListener("click", closeProfileEditor);
profileEditBackdrop?.addEventListener("click", event => {
    if (event.target === profileEditBackdrop) closeProfileEditor();
});

editProfileImage?.addEventListener("change", () => {
    const file = editProfileImage.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        pendingProfileImage = reader.result;
        profileEditPreview.src = pendingProfileImage;
        profileEditPreview.hidden = false;
    };
    reader.readAsDataURL(file);
});

editStoreImage?.addEventListener("change", () => {
    const file = editStoreImage.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        pendingStoreImage = reader.result;
        storeEditPreview.src = pendingStoreImage;
        storeEditPreview.hidden = false;
    };
    reader.readAsDataURL(file);
});

profileEditForm?.addEventListener("submit", event => {
    event.preventDefault();
    const name = editProfileName.value.trim();
    const email = editProfileEmail.value.trim().toLowerCase();
    const storeName = editStoreName.value.trim();
    const location = { sector: editStoreSector.value.trim(), street: editStoreStreet.value.trim(), box: editStoreBox.value.trim() };
    const segments = [...profileEditForm.querySelectorAll('input[name="segment"]:checked')].map(input => input.value);
    const users = JSON.parse(localStorage.getItem("modaCenterUsers") || "[]");
    const user = users.find(item => String(item.id) === String(session?.id));

    if (!name || !email || !storeName || segments.length === 0 || !location.sector || !location.street || !location.box) {
        profileEditNote.textContent = "Preencha os dados, a localização e selecione pelo menos um segmento.";
        return;
    }

    if (String(session?.id) !== "admin" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        profileEditNote.textContent = "Informe um e-mail válido com @.";
        return;
    }

    if (users.some(item => String(item.id) !== String(session?.id) && item.email.toLowerCase() === email)) {
        profileEditNote.textContent = "Este e-mail já está cadastrado.";
        return;
    }

    if (user) {
        user.name = name;
        user.email = email;
        user.avatar = pendingProfileImage || null;
    }

    localStorage.setItem("modaCenterUsers", JSON.stringify(users));
    const updatedSession = { ...session, name, email, avatar: pendingProfileImage || null };
    localStorage.setItem("modaCenterSession", JSON.stringify(updatedSession));
    Object.assign(session, updatedSession);
    stores[session.id] = { ...stores[session.id], name: storeName, segments, image: pendingStoreImage || null, location, createdAt: stores[session.id]?.createdAt || Date.now() };
    localStorage.setItem("modaCenterStores", JSON.stringify(stores));
    if (window.location.protocol !== "file:") {
        fetch(`/api/stores/${encodeURIComponent(session.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...stores[session.id], ownerId: session.id }) }).catch(() => {});
    }

    profileViewName.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    profileStoreName.textContent = storeName;
    settingsName.textContent = name;
    updateProfileAvatar(pendingProfileImage);
    closeProfileEditor();
    settingsBackdrop.classList.remove("open");
    settingsBackdrop.setAttribute("aria-hidden", "true");
});

settingsBackdrop?.addEventListener("click", event => {
    if (event.target === settingsBackdrop) {
        settingsBackdrop.classList.remove("open");
        settingsBackdrop.setAttribute("aria-hidden", "true");
    }
});

// Fecha o painel de configurações também com a tecla Esc, do mesmo
// jeito que os modais das outras páginas do site.
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        settingsBackdrop?.classList.remove("open");
        settingsBackdrop?.setAttribute("aria-hidden", "true");
        closeProfileEditor();
        closeInsights();
    }
});

// Encerra a sessao e retorna ao formulario de login.
document.getElementById("settingsLogout")?.addEventListener("click", () => {
    localStorage.removeItem("modaCenterSession");
    localStorage.removeItem("modaCenterUserName");
    window.location.href = "../../index.html?login=1";
});

// Todos os destinos do menu inferior usam arquivos independentes.
document.querySelectorAll(".bottom-navigation .nav-item").forEach(button => {
    button.addEventListener("click", () => {
        const page = button.dataset.page;
        if (page) window.location.href = page;
    });
});
