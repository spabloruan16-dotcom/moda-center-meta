const PRODUCTS_KEY = "modaCenterProducts";
const STORES_KEY = "modaCenterStores";
const SESSION_KEY = "modaCenterSession";
const USERS_KEY = "modaCenterUsers";
const PURCHASES_KEY = "modaCenterPurchases";
const CART_KEY = "modaCenterCart";
const COUPON_KEY = "modaCenterClientCoupons";
const HIGHLIGHTS_KEY = "modaCenterHighlights";
const PLACEHOLDER = "../../assets/images/produtos/sem-foto.svg";
const API_ENABLED = window.location.protocol !== "file:";

const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
const productsElement = document.getElementById("clientProducts");
const searchElement = document.getElementById("catalogSearch");
const noteElement = document.getElementById("clientNote");
const cartButton = document.getElementById("cartButton");
const cartCountElement = document.getElementById("cartCount");
const cartPanel = document.getElementById("cartPanel");
const cartItemsElement = document.getElementById("cartItems");
const cartTotalElement = document.getElementById("cartTotal");
const cartSubtotalElement = document.getElementById("cartSubtotal");
const cartDiscountRow = document.getElementById("cartDiscountRow");
const cartDiscountElement = document.getElementById("cartDiscount");
const couponInput = document.getElementById("couponInput");
const applyCouponButton = document.getElementById("applyCouponButton");
const removeCouponButton = document.getElementById("removeCouponButton");
const couponNote = document.getElementById("couponNote");
const checkoutButton = document.getElementById("checkoutButton");
const checkoutModal = document.getElementById("checkoutModal");
const checkoutNote = document.getElementById("checkoutNote");
const deliveryAddressFields = document.getElementById("deliveryAddressFields");
const pickupInfo = document.getElementById("pickupInfo");
const orderReceiptModal = document.getElementById("orderReceiptModal");
const receiptSummary = document.getElementById("receiptSummary");
const addressInputs = { recipient: document.getElementById("deliveryRecipient"), zip: document.getElementById("deliveryZip"), street: document.getElementById("deliveryStreet"), city: document.getElementById("deliveryCity"), state: document.getElementById("deliveryState"), complement: document.getElementById("deliveryComplement") };
const productDetailsModal = document.getElementById("productDetailsModal");
const productDetailsContent = document.getElementById("productDetailsContent");
const storeViewModal = document.getElementById("storeViewModal");
const storeViewContent = document.getElementById("storeViewContent");
const styleStudioModal = document.getElementById("styleStudioModal");
const magicMirrorModal = document.getElementById("magicMirrorModal");
const lookForm = document.getElementById("lookForm");
const lookResult = document.getElementById("lookResult");
const mirrorPhoto = document.getElementById("mirrorPhoto");
const mirrorStage = document.getElementById("mirrorStage");
const mirrorLookItems = document.getElementById("mirrorLookItems");
const saveMirrorPhotoButton = document.getElementById("saveMirrorPhoto");
const stores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
let catalogProducts = [];
let catalogStores = stores;
let serverCoupons = [];
let serverLoyaltyCards = [];
const deliveredPurchases = new Set();

function updateClientPresence(status = "online") {
    if (!API_ENABLED || !session) return;
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: session.id, status }) }).catch(() => {});
}

if (!session || session.profile !== "cliente") {
    window.location.href = "../../index.html?login=1";
}

document.getElementById("clientGreeting").textContent = `Olá, ${session?.name || "cliente"}. Escolha um produto para comprar.`;

document.getElementById("clientLogout").addEventListener("click", () => {
    updateClientPresence("offline");
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "../../index.html?login=1";
});

updateClientPresence();
window.setInterval(() => updateClientPresence(), 15000);


function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function readBulkPromotions() {
    try {
        const all = JSON.parse(localStorage.getItem("modaCenterBulkPromotions") || "{}");
        return Object.values(all).flatMap(list => Array.isArray(list) ? list : []);
    } catch (error) {
        console.warn("Não foi possível ler as promoções Leve Mais por Menos.", error);
        return [];
    }
}

function getBulkPromotion(productId, quantity = 1) {
    const qty = Number(quantity) || 0;
    if (qty < 1) return null;

    return readBulkPromotions()
        .filter(promotion => {
            const productIds = Array.isArray(promotion.productIds)
                ? promotion.productIds.map(String)
                : [];
            const minUnits = Number(promotion.minUnits);
            const discount = Number(promotion.discount);
            return productIds.includes(String(productId)) &&
                Number.isFinite(minUnits) && minUnits > 0 && qty >= minUnits &&
                Number.isFinite(discount) && discount > 0;
        })
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
}

function getProductUnitPrice(product, quantity = 1) {
    const originalPrice = Number(product?.price || 0);
    const promotion = getBulkPromotion(product?.id, quantity);

    // Leve Mais por Menos tem prioridade quando a quantidade mínima foi atingida.
    if (promotion) {
        const discount = Math.min(100, Math.max(0, Number(promotion.discount) || 0));
        return originalPrice * (1 - discount / 100);
    }

    const regularDiscount = Math.min(100, Math.max(0, Number(product?.discount) || 0));
    return originalPrice * (1 - regularDiscount / 100);
}

function applyBulkPromotions(products) {
    const promotions = readBulkPromotions();
    return products.map(product => {
        const promotion = promotions
            .filter(item => Array.isArray(item.productIds) && item.productIds.map(String).includes(String(product.id)))
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];

        return promotion ? {
            ...product,
            bulkOffer: {
                minUnits: Number(promotion.minUnits),
                discount: Number(promotion.discount),
                campaignId: promotion.id,
                campaignName: promotion.name || "Leve Mais por Menos"
            }
        } : product;
    });
}

function isRealPublishedProduct(product) {
    if (!product || !String(product.name || "").trim()) return false;
    // Remove o produto de demonstração antigo que podia reaparecer pelo localStorage.
    if (String(product.id || "") === "p1" && String(product.ownerId || "") === "test-merchant") return false;
    return true;
}

function readProducts() {
    let products;
    if (catalogProducts.length) {
        products = catalogProducts.filter(isRealPublishedProduct);
    } else {
        const allProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
        products = Object.entries(allProducts).flatMap(([ownerId, list]) => (Array.isArray(list) ? list : []).map(product => ({ ...product, ownerId }))).filter(isRealPublishedProduct);
    }
    return applyBulkPromotions(products);
}

function readStylePreferences() {
    const saved = JSON.parse(localStorage.getItem("modaCenterStylePreferences") || "{}");
    return saved[session?.id] || {};
}

function saveStylePreferences(preferences) {
    const saved = JSON.parse(localStorage.getItem("modaCenterStylePreferences") || "{}");
    saved[session.id] = preferences;
    localStorage.setItem("modaCenterStylePreferences", JSON.stringify(saved));
}

function productText(product) { return `${product.name || ""} ${product.category || ""} ${(product.segments || []).join(" ")}`.toLowerCase(); }
function scoreLookProduct(product, role, occasion, style, preference) {
    const text = productText(product);
    const roleWords = { top: ["blusa", "camisa", "cropped", "regata", "top", "jaqueta", "blazer", "casaco", "vestido"], bottom: ["calça", "saia", "short", "bermuda", "jeans", "legging"], shoe: ["sapato", "tênis", "sandália", "sapatilha", "bota", "salto"], accessory: ["bolsa", "cinto", "brinco", "colar", "acessório"] };
    const occasionWords = { casamento: ["vestido", "blazer", "social", "elegante", "salto"], trabalho: ["blazer", "camisa", "calça", "social"], casual: ["jeans", "tênis", "blusa", "confortável"], encontro: ["vestido", "saia", "blusa", "elegante"], "fim de semana": ["short", "bermuda", "tênis", "confortável"] };
    const styleWords = { elegante: ["social", "blazer", "vestido", "alfaiataria"], confortável: ["moletom", "malha", "tênis", "legging"], minimalista: ["básico", "liso", "neutro", "branco", "preto"], marcante: ["estamp", "vermelho", "brilho", "color"], romântico: ["flor", "renda", "saia", "vestido"] };
    let score = Number(product.quantity || 0) > 0 ? 1 : -100;
    if (roleWords[role].some(word => text.includes(word))) score += 6;
    const occasionText = occasion.toLowerCase();
    const styleText = style.toLowerCase();
    if (Object.entries(occasionWords).some(([key, words]) => occasionText.includes(key) && words.some(word => text.includes(word)))) score += 3;
    if (Object.entries(styleWords).some(([key, words]) => styleText.includes(key) && words.some(word => text.includes(word)))) score += 3;
    if (preference && preference.split(/[, ]+/).some(word => word.length > 2 && text.includes(word.toLowerCase()))) score += 5;
    return score;
}

function chooseLookProducts(occasion, style, preference, budget) {
    const products = readProducts().filter(product => Number(product.quantity || 0) > 0);
    const roles = ["top", "bottom", "shoe"];
    const selected = [];
    roles.forEach(role => {
        const candidate = products.filter(product => !selected.includes(product)).map(product => ({ product, score: scoreLookProduct(product, role, occasion, style, preference) })).sort((a, b) => b.score - a.score)[0]?.product;
        if (candidate) selected.push(candidate);
    });
    const total = selected.reduce((sum, product) => sum + Number(product.price || 0) * (1 - Number(product.discount || 0) / 100), 0);
    if (budget > 0 && total > budget) {
        selected.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        while (selected.length > 1 && selected.reduce((sum, product) => sum + Number(product.price || 0) * (1 - Number(product.discount || 0) / 100), 0) > budget) selected.pop();
    }
    return selected;
}

function lookTotal(products) { return products.reduce((sum, product) => sum + Number(product.price || 0) * (1 - Number(product.discount || 0) / 100), 0); }
function addLookToCart(products) { products.forEach(product => buyProduct(product.id, null, 1)); cartPanel.hidden = false; }
function setMirrorLook(products) {
    mirrorLookItems.innerHTML = products.length ? products.map(product => `<span><img src="${escapeHtml(product.image || PLACEHOLDER)}" alt="">${escapeHtml(product.name)}</span>`).join("") : "<p>Crie um look primeiro para visualizar as peças.</p>";
    mirrorLookItems.dataset.productIds = products.map(product => product.id).join(",");
}

function getMirrorProducts() {
    const ids = String(mirrorLookItems.dataset.productIds || "").split(",").filter(Boolean);
    return readProducts().filter(product => ids.includes(String(product.id)));
}

function drawCoverImage(context, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function saveMirrorPhoto() {
    if (!mirrorPhoto.src || mirrorPhoto.hidden) {
        mirrorStage.classList.add("mirror-needs-photo");
        return;
    }
    const renderDownload = image => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 1500;
        const context = canvas.getContext("2d");
        const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
        background.addColorStop(0, "#321173");
        background.addColorStop(.55, "#6e2bd4");
        background.addColorStop(1, "#ff7a18");
        context.fillStyle = background;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.globalAlpha = .12;
        context.fillStyle = "#ffffff";
        for (let y = 80; y < canvas.height; y += 190) for (let x = -100; x < canvas.width; x += 280) { context.beginPath(); context.arc(x, y, 90, 0, Math.PI * 2); context.fill(); }
        context.globalAlpha = 1;
        context.fillStyle = "#ffffff";
        context.font = "700 44px Arial";
        context.fillText("MODA CENTER", 70, 90);
        context.font = "500 20px Arial";
        context.fillText("ESPELHO MÁGICO · MEU LOOK", 72, 124);
        context.save();
        context.beginPath();
        context.roundRect(55, 165, 1090, 920, 28);
        context.clip();
        context.fillStyle = "#f8f4ff";
        context.fillRect(55, 165, 1090, 920);
        drawCoverImage(context, image, 75, 185, 650, 880);
        context.restore();
        context.fillStyle = "rgba(255,255,255,.94)";
        context.beginPath();
        context.roundRect(755, 205, 350, 840, 22);
        context.fill();
        context.fillStyle = "#321173";
        context.font = "700 27px Arial";
        context.fillText("Peças do look", 790, 260);
        let itemY = 315;
        getMirrorProducts().forEach(product => {
            context.fillStyle = "#21183b";
            context.font = "700 22px Arial";
            context.fillText(String(product.name || "Produto").slice(0, 22), 790, itemY);
            context.fillStyle = "#5926c9";
            context.font = "600 20px Arial";
            context.fillText(`R$ ${Number(product.price || 0).toFixed(2).replace(".", ",")}`, 790, itemY + 31);
            itemY += 92;
        });
        context.fillStyle = "rgba(50,17,115,.2)";
        context.font = "700 35px Arial";
        context.rotate(-.18);
        context.fillText("MODA CENTER", 105, 960);
        context.rotate(.18);
        context.fillStyle = "#ffffff";
        context.font = "500 18px Arial";
        context.fillText("Imagem criada no Moda Center", 70, 1415);
        const link = document.createElement("a");
        document.body.appendChild(link);
        link.download = `meu-look-moda-center-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        window.setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
    };
    if (mirrorPhoto.complete) renderDownload(mirrorPhoto);
    else {
        const image = new Image();
        image.onload = () => renderDownload(image);
        image.src = mirrorPhoto.src;
    }
}

function openLookStudio() {
    const preferences = readStylePreferences();
    document.getElementById("lookOccasion").value = preferences.occasion || "";
    document.getElementById("lookStyle").value = preferences.style || "";
    document.getElementById("lookPreference").value = preferences.preference || "";
    document.getElementById("lookBudget").value = preferences.budget || "";
    lookResult.hidden = true;
    styleStudioModal.hidden = false;
}

function renderLookResult(products, occasion, style) {
    const total = lookTotal(products);
    lookResult.innerHTML = products.length ? `<div class="look-result-heading"><div><span>LOOK SUGERIDO</span><h3>${escapeHtml(occasion)} · ${escapeHtml(style)}</h3></div><strong>R$ ${total.toFixed(2).replace(".", ",")}</strong></div><div class="look-product-list">${products.map(product => { const finalPrice = Number(product.price || 0) * (1 - Number(product.discount || 0) / 100); return `<article><img src="${escapeHtml(product.image || PLACEHOLDER)}" alt="${escapeHtml(product.name)}"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "Moda")} · R$ ${finalPrice.toFixed(2).replace(".", ",")}</small></div></article>`; }).join("")}</div><div class="look-result-actions"><button id="saveLookButton" type="button">♡ Salvar look</button><button id="addLookButton" type="button">Adicionar tudo ao carrinho</button><button id="mirrorFromLookButton" type="button">Ver no espelho mágico</button></div>` : `<p class="look-empty">Não encontrei peças suficientes disponíveis para montar este look.</p>`;
    lookResult.hidden = false;
    setMirrorLook(products);
    document.getElementById("addLookButton")?.addEventListener("click", () => { addLookToCart(products); lookResult.querySelector(".look-result-actions").insertAdjacentHTML("afterend", '<p class="look-feedback">Look adicionado ao carrinho.</p>'); });
    document.getElementById("saveLookButton")?.addEventListener("click", () => { const saved = JSON.parse(localStorage.getItem("modaCenterSavedLooks") || "{}"); saved[session.id] ||= []; saved[session.id].unshift({ id: Date.now(), occasion, style, productIds: products.map(product => product.id), createdAt: Date.now() }); localStorage.setItem("modaCenterSavedLooks", JSON.stringify(saved)); document.getElementById("saveLookButton").textContent = "✓ Look salvo"; });
    document.getElementById("mirrorFromLookButton")?.addEventListener("click", () => { styleStudioModal.hidden = true; magicMirrorModal.hidden = false; });
}

async function loadCatalog() {
    if (!API_ENABLED) return;
    try {
        const response = await fetch("/api/catalog", { cache: "no-store" });
        if (!response.ok) throw new Error("Catalogo indisponivel");
        const data = await response.json();
        catalogProducts = Array.isArray(data.products) ? data.products : [];
        catalogStores = data.stores || {};
        serverCoupons = Array.isArray(data.coupons) ? data.coupons : serverCoupons;
        serverLoyaltyCards = Array.isArray(data.loyaltyCards) ? data.loyaltyCards : serverLoyaltyCards;
        const ordersResponse = await fetch(`/api/orders?clientId=${encodeURIComponent(session.id)}`, { cache: "no-store" });
        if (ordersResponse.ok) {
            const ordersData = await ordersResponse.json();
            ordersData.orders.filter(order => order.status === "entregue").flatMap(order => order.items || []).forEach(item => deliveredPurchases.add(String(item.productId)));
        }
        render();
    } catch (error) {
        noteElement.textContent = "Não foi possível atualizar o catálogo. Exibindo dados locais.";
    }
}

function saveProducts(products) {
    const grouped = {};
    products.forEach(product => {
        grouped[product.ownerId] ||= [];
        const { ownerId, ...data } = product;
        grouped[ownerId].push(data);
    });
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(grouped));
}

function getPurchases() {
    const purchases = JSON.parse(localStorage.getItem(PURCHASES_KEY) || "{}");
    return Array.isArray(purchases[session.id]) ? purchases[session.id] : [];
}

function savePurchase(productId) {
    const purchases = JSON.parse(localStorage.getItem(PURCHASES_KEY) || "{}");
    purchases[session.id] ||= [];
    if (!purchases[session.id].includes(String(productId))) purchases[session.id].push(String(productId));
    localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
}

function getCart() {
    const carts = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    return Array.isArray(carts[session.id]) ? carts[session.id] : [];
}

function saveCart(cart) {
    const carts = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
    carts[session.id] = cart;
    localStorage.setItem(CART_KEY, JSON.stringify(carts));
}

function getSavedAddress() { return session.deliveryAddress && typeof session.deliveryAddress === "object" ? session.deliveryAddress : {}; }
function fillCheckoutAddress() { const address = getSavedAddress(); Object.entries(addressInputs).forEach(([key, input]) => { if (input) input.value = address[key] || ""; }); }
function readCheckoutAddress() { return Object.fromEntries(Object.entries(addressInputs).map(([key, input]) => [key, input?.value.trim() || ""])); }
function getCartStores() {
    const products = readProducts();
    const localStores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    return [...new Map(getCart().map(item => products.find(product => String(product.id) === String(item.productId))).filter(Boolean).map(product => [String(product.ownerId), product])).values()].map(product => ({ name: catalogStores[product.ownerId]?.name || localStores[product.ownerId]?.name || product.ownerName || "Loja Moda Center", location: catalogStores[product.ownerId]?.location || localStores[product.ownerId]?.location || null }));
}

function getVariations(product) {
    return Array.isArray(product.variations) ? product.variations.filter(variation => variation.color && variation.size) : [];
}

function getVariation(product, variationId) {
    return getVariations(product).find(variation => String(variation.id) === String(variationId));
}

function getCartQuantity(productId, variationId = null) {
    return getCart().filter(item => String(item.productId) === String(productId) && (variationId === null || String(item.variationId || "") === String(variationId))).reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function updateCartCount() {
    const total = getCart().reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    cartCountElement.textContent = total;
}

const orderStatusLabels = { recebido: "Recebido", preparando: "Preparando", postado: "Postado", enviado: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };
const orderStatusIcons = { recebido: "🧾", preparando: "📦", postado: "🏷️", enviado: "🚚", entregue: "✅", cancelado: "⚠️" };

async function loadClientOrders() {
    return;
}

function ratingSummary(product) {
    const ratings = Array.isArray(product.ratings) ? product.ratings : [];
    const average = ratings.length ? ratings.reduce((sum, rating) => sum + Number(rating.value), 0) / ratings.length : 0;
    return `${average.toFixed(2).replace(".", ",")} ★ (${ratings.length})`;
}
function readLocalHighlights() {
    const all = JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) || "{}");
    return all || {};
}

function getStoreHighlights(ownerId) {
    const products = readProducts();
    const local = readLocalHighlights();
    const localIds = new Set(Array.isArray(local[ownerId]) ? local[ownerId].map(item => String(item.productId)) : []);
    return products.filter(product => String(product.ownerId) === String(ownerId) && (product.highlighted === true || localIds.has(String(product.id))));
}

function storeNameFor(ownerId) {
    const localStores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    return catalogStores[ownerId]?.name || localStores[ownerId]?.name || "Loja Moda Center";
}

function productCardMarkup(product) {
    const finalPrice = Number(product.price || 0) * (1 - Number(product.discount || 0) / 100);
    return `<article class="store-product-card" data-store-product-id="${escapeHtml(product.id)}"><img src="${escapeHtml(product.image || PLACEHOLDER)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "Produto")}</small><b>R$ ${finalPrice.toFixed(2).replace(".", ",")}</b></div></article>`;
}

function openStoreView(ownerId) {
    const products = readProducts().filter(product => String(product.ownerId) === String(ownerId));
    const highlights = getStoreHighlights(ownerId);
    const localStores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    const store = catalogStores[ownerId] || localStores[ownerId] || {};
    const name = store.name || storeNameFor(ownerId);
    storeViewContent.innerHTML = `<div class="store-view-hero"><div class="store-avatar">${store.image ? `<img src="${escapeHtml(store.image)}" alt="">` : "🏪"}</div><div class="store-view-hero-info"><p class="eyebrow">LOJA</p><h2 id="storeViewTitle">${escapeHtml(name)}</h2><small>${escapeHtml((store.segments || []).join(" · ") || "Moda e acessórios")}</small></div><a class="store-start-chat" href="../../Comerciante/pages/chat_comerciante.html?merchant=${encodeURIComponent(ownerId)}">Iniciar chat</a></div><div class="store-tabs" role="tablist"><button type="button" class="store-tab active" data-store-tab="highlights">★ Meus destaques <span>${highlights.length}</span></button><button type="button" class="store-tab" data-store-tab="products">Todos os produtos <span>${products.length}</span></button></div><section class="store-tab-panel" data-store-panel="highlights"><div class="store-section-heading"><div><p class="eyebrow">SELEÇÃO DA LOJA</p><h3>Meus destaques</h3></div><span>★</span></div>${highlights.length ? `<div class="store-product-grid">${highlights.map(productCardMarkup).join("")}</div>` : `<div class="store-empty"><span>☆</span><strong>Nenhum destaque por enquanto</strong><small>Esta loja ainda não selecionou produtos para aparecer aqui.</small></div>`}</section><section class="store-tab-panel" data-store-panel="products" hidden><div class="store-section-heading"><div><p class="eyebrow">CATÁLOGO</p><h3>Todos os produtos</h3></div></div>${products.length ? `<div class="store-product-grid">${products.map(productCardMarkup).join("")}</div>` : `<div class="store-empty"><strong>Nenhum produto disponível.</strong></div>`}</section>`;
    storeViewContent.querySelectorAll(".store-tab").forEach(tab => tab.addEventListener("click", () => { storeViewContent.querySelectorAll(".store-tab").forEach(item => item.classList.toggle("active", item === tab)); storeViewContent.querySelectorAll(".store-tab-panel").forEach(panel => panel.hidden = panel.dataset.storePanel !== tab.dataset.storeTab); }));
    storeViewContent.querySelectorAll("[data-store-product-id]").forEach(card => card.addEventListener("click", () => { storeViewModal.hidden = true; openProductDetails(card.dataset.storeProductId); }));
    storeViewModal.hidden = false;
}

function render() {
    const query = searchElement.value.trim().toLowerCase();
    const products = readProducts().filter(product => String(product.name).toLowerCase().includes(query));

    if (!products.length) {
        productsElement.innerHTML = `<div class="empty-state">Nenhum produto encontrado.</div>`;
        return;
    }

    productsElement.innerHTML = products.map(product => {
        const cartQuantity = getCartQuantity(product.id);
        const stock = Number(product.quantity || 0);
        const storeName = catalogStores[product.ownerId]?.name || product.ownerName || "Loja Moda Center";
        return `<article class="client-card" data-view-product-id="${escapeHtml(product.id)}" tabindex="0" aria-label="Ver detalhes de ${escapeHtml(product.name)}">
            <img src="${escapeHtml(product.image || PLACEHOLDER)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
            <div class="client-card-body">
                <h3>${escapeHtml(product.name)}</h3>
                <button class="store-name store-name-button" type="button" data-view-store-id="${escapeHtml(product.ownerId)}">${escapeHtml(storeName)}</button>
                <p class="store-name">${escapeHtml(storeName)}</p>
                <p class="price">R$ ${Number(product.price || 0).toFixed(2).replace(".", ",")}</p>
                <p class="stock">${stock > 0 ? `${stock} em estoque` : "Produto esgotado"}</p>
                <p class="rating">${ratingSummary(product)}</p>
            </div>
        </article>`;
    }).join("");

    productsElement.querySelectorAll(".client-card").forEach(card => {
        const openDetails = () => openProductDetails(card.dataset.viewProductId);
        card.addEventListener("click", openDetails);
        card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetails(); } });
    });
    productsElement.querySelectorAll("[data-view-store-id]").forEach(button => button.addEventListener("click", event => { event.stopPropagation(); openStoreView(button.dataset.viewStoreId); }));
    productsElement.querySelectorAll(".buy-button, .rating-button, .chat-button").forEach(element => element.addEventListener("click", event => event.stopPropagation()));
    updateCartCount();
}

function buyProduct(productId, variationId = null, requestedQuantity = 1) {
    const product = readProducts().find(item => String(item.id) === String(productId));
    const cart = getCart();
    const variation = variationId === null ? null : getVariation(product, variationId);
    const item = cart.find(entry => String(entry.productId) === String(productId) && String(entry.variationId || "") === String(variationId || ""));
    const currentQuantity = item?.quantity || 0;
    const stock = variation ? Number(variation.quantity || 0) : Number(product?.quantity || 0);
    const quantity = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
    if (!product || currentQuantity + quantity > stock) return;
    if (item) item.quantity += quantity;
    else cart.push({ productId: String(productId), variationId: variationId === null ? null : String(variationId), quantity });
    saveCart(cart);
    noteElement.textContent = "Produto adicionado ao carrinho.";
    renderCart();
    render();
    cartPanel.hidden = false;
}

function getClientCoupons() {
    try {
        const coupons = JSON.parse(localStorage.getItem(COUPON_KEY) || "{}");
        return Array.isArray(coupons[session?.id]) ? coupons[session.id] : [];
    } catch { return []; }
}
function saveClientCoupons(coupons) {
    const allCoupons = JSON.parse(localStorage.getItem(COUPON_KEY) || "{}");
    if (coupons.length) allCoupons[session.id] = coupons;
    else delete allCoupons[session.id];
    localStorage.setItem(COUPON_KEY, JSON.stringify(allCoupons));
}
function readMerchantCampaigns(ownerId) {
    const allCampaigns = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || "{}");
    return Array.isArray(allCampaigns[ownerId]) ? allCampaigns[ownerId] : [];
}
function couponIsValidForProduct(coupon, product) {
    if (!coupon || !product || (coupon.type !== "coupon" && coupon.type !== "cupons")) return false;
    if (coupon.active === false) return false;
    if (coupon.start && new Date(coupon.start) > new Date()) return false;
    if (coupon.end && new Date(coupon.end) < new Date()) return false;
    if (coupon.limit && Number(coupon.used || 0) >= Number(coupon.limit)) return false;
    if (coupon.scope === "all") return true;
    if (coupon.scope === "category") return String(product.category || "") === String(coupon.category || "");
    if (coupon.scope === "product") return String(product.id) === String(coupon.productId);
    return false;
}
function findCoupon(code) {
    const exactCode = String(code || "").trim();
    if (!exactCode) return null;
    const products = readProducts();
    for (const item of getCart()) {
        const product = products.find(entry => String(entry.id) === String(item.productId));
        if (!product) continue;
        const candidates = [...serverCoupons, ...readMerchantCampaigns(product.ownerId)];
        const coupon = candidates.find(campaign => String(campaign.ownerId) === String(product.ownerId) && String(campaign.code || "").trim().toLowerCase() === exactCode.toLowerCase() && (campaign.type === "coupon" || campaign.type === "cupons"));
        if (coupon) return { ...coupon, ownerId: product.ownerId };
    }
    return null;
}

async function syncCoupons() {
    if (!API_ENABLED) return;
    try {
        const response = await fetch("/api/coupons", { cache: "no-store" });
        if (response.ok) { const data = await response.json(); serverCoupons = Array.isArray(data.coupons) ? data.coupons : []; renderCart(); }
    } catch (_) {}
}
function getCouponsDiscount(coupons = getClientCoupons(), cart = getCart()) {
    const products = readProducts();
    let subtotal = 0;
    cart.forEach(item => {
        const product = products.find(entry => String(entry.id) === String(item.productId));
        if (product) subtotal += Number(product.price || 0) * Number(item.quantity || 0);
    });
    let total = subtotal, discount = 0;
    coupons.forEach(coupon => {
        let couponDiscount = 0;
        cart.forEach(item => {
            const product = products.find(entry => String(entry.id) === String(item.productId));
            if (!product || String(product.ownerId) !== String(coupon.ownerId) || !couponIsValidForProduct(coupon, product)) return;
            const itemSubtotal = Number(product.price || 0) * Number(item.quantity || 0);
            if (subtotal > 0) couponDiscount += (itemSubtotal / subtotal) * total * (Number(coupon.discount || 0) / 100);
        });
        total = Math.max(0, total - couponDiscount);
        discount += couponDiscount;
    });
    return { subtotal, discount, total };
}
function clearCoupon() {
    saveClientCoupons([]);
    if (couponInput) couponInput.value = "";
    if (couponNote) couponNote.textContent = "";
    if (removeCouponButton) removeCouponButton.hidden = true;
    renderCart();
}
async function applyCoupon() {
    const code = couponInput?.value.trim();
    if (!code) { if (couponNote) couponNote.textContent = "Digite um código de cupom."; return; }
    let coupon = findCoupon(code);
    if (!coupon && API_ENABLED) { await syncCoupons(); coupon = findCoupon(code); }
    if (!coupon) { couponNote.textContent = "Cupom inválido ou não disponível para este carrinho."; return; }
    const coupons = getClientCoupons();
    if (coupons.some(item => String(item.code || "").trim().toLowerCase() === code.toLowerCase())) { couponNote.textContent = "Este cupom já foi aplicado."; return; }

    if (API_ENABLED) {
        try {
            const response = await fetch("/api/coupons/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    items: getCart().map(item => ({ productId: item.productId, quantity: item.quantity }))
                })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || Number(data.discount || 0) <= 0) {
                couponNote.textContent = data.error || "Este cupom não se aplica aos produtos do seu carrinho.";
                return;
            }
            coupon = { ...data.coupon, ownerId: data.coupon.ownerId };
        } catch (_) {
            const testResult = getCouponsDiscount([...coupons, coupon]);
            if (testResult.discount <= 0) { couponNote.textContent = "Este cupom não se aplica aos produtos do seu carrinho."; return; }
        }
    } else {
        const testResult = getCouponsDiscount([...coupons, coupon]);
        if (testResult.discount <= 0) { couponNote.textContent = "Este cupom não se aplica aos produtos do seu carrinho."; return; }
    }
    coupons.push(coupon);
    saveClientCoupons(coupons);
    couponInput.value = "";
    couponNote.textContent = `Cupom ${code.toUpperCase()} aplicado! O desconto foi incluído no total.\n`;
    renderCart();
}

function renderCart() {
    const products = readProducts();
    const cart = getCart();
    let total = 0;
    cartItemsElement.innerHTML = "";

    cart.forEach(item => {
        const product = products.find(entry => String(entry.id) === String(item.productId));
        if (!product) return;

        const quantity = Math.max(0, Number(item.quantity || 0));
        const originalUnitPrice = Number(product.price || 0);
        const promotion = getBulkPromotion(product.id, quantity);
        const regularDiscount = Math.min(100, Math.max(0, Number(product.discount || 0)));
        const discountPercent = promotion ? Number(promotion.discount) : regularDiscount;
        const unitPrice = getProductUnitPrice(product, quantity);
        const subtotal = unitPrice * quantity;
        const hasDiscount = discountPercent > 0 && unitPrice < originalUnitPrice;
        const hasBulkDiscount = Boolean(promotion);
        const variation = getVariation(product, item.variationId);
        const variationLabel = variation ? ` · ${variation.color} / ${variation.size}` : "";

        const priceLabel = hasDiscount
            ? `<span class="cart-old-price">R$ ${originalUnitPrice.toFixed(2).replace(".", ",")}</span> <strong class="cart-discount-price">R$ ${unitPrice.toFixed(2).replace(".", ",")}</strong> <small>${discountPercent.toFixed(0)}% OFF</small>`
            : `R$ ${unitPrice.toFixed(2).replace(".", ",")}`;

        const promoLabel = hasBulkDiscount
            ? `<small class="cart-promo-label">Leve Mais por Menos · ${escapeHtml(promotion.name || "Promoção")} · a partir de ${Number(promotion.minUnits)} unidades</small>`
            : "";

        total += subtotal;

        const element = document.createElement("div");
        element.className = "cart-item";
        element.dataset.productId = product.id;
        element.tabIndex = 0;
        element.dataset.variationId = item.variationId || "";
        element.innerHTML = `<img class="cart-item-image" src="${escapeHtml(product.image || PLACEHOLDER)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div><h3>${escapeHtml(product.name)}</h3><p>${quantity} unidade(s)${escapeHtml(variationLabel)} x ${priceLabel}</p>${promoLabel}</div><div><strong>R$ ${subtotal.toFixed(2).replace(".", ",")}</strong><button class="remove-cart-item" type="button" data-product-id="${escapeHtml(product.id)}" data-variation-id="${escapeHtml(item.variationId || "")}">Remover</button></div>`;
        cartItemsElement.appendChild(element);
    });

    if (!cartItemsElement.children.length) cartItemsElement.innerHTML = `<p class="empty-state">Seu carrinho está vazio.</p>`;

    let coupons = getClientCoupons();
    coupons = coupons.map(coupon => findCoupon(coupon.code)).filter(Boolean);
    saveClientCoupons(coupons);
    const couponResult = getCouponsDiscount(coupons, cart);
    const finalTotal = Math.max(0, total - couponResult.discount);
    if (cartSubtotalElement) cartSubtotalElement.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
    if (cartDiscountElement) cartDiscountElement.textContent = `- R$ ${couponResult.discount.toFixed(2).replace(".", ",")}`;
    if (cartDiscountRow) cartDiscountRow.hidden = couponResult.discount <= 0;
    if (couponNote) {
        couponNote.innerHTML = coupons.length
            ? coupons.map(coupon => `<div class="applied-coupon"><span>🎫 ${escapeHtml(coupon.code)} — ${Number(coupon.discount)}% OFF</span><button type="button" class="remove-one-coupon" data-coupon-code="${escapeHtml(coupon.code)}">×</button></div>`).join("")
            : "";
        couponNote.querySelectorAll(".remove-one-coupon").forEach(button => button.addEventListener("click", () => {
            saveClientCoupons(getClientCoupons().filter(c => String(c.code || "").trim() !== String(button.dataset.couponCode || "").trim()));
            renderCart();
        }));
    }
    if (removeCouponButton) removeCouponButton.hidden = coupons.length === 0;
    cartTotalElement.textContent = `R$ ${finalTotal.toFixed(2).replace(".", ",")}`;
    checkoutButton.disabled = !cart.length;
    updateCartCount();

    cartItemsElement.querySelectorAll(".remove-cart-item").forEach(button => button.addEventListener("click", () => {
        saveCart(getCart().filter(item => !(String(item.productId) === String(button.dataset.productId) && String(item.variationId || "") === String(button.dataset.variationId || ""))));
        renderCart();
    }));

    cartItemsElement.querySelectorAll(".cart-item").forEach(item => {
        const openDetails = () => openProductDetails(item.dataset.productId);
        item.addEventListener("click", event => { if (!event.target.closest(".remove-cart-item")) openDetails(); });
        item.addEventListener("keydown", event => { if ((event.key === "Enter" || event.key === " ") && !event.target.closest(".remove-cart-item")) { event.preventDefault(); openDetails(); } });
    });
}

async function checkoutCart() {
    const cart = getCart();
    if (!cart.length) return;
    fillCheckoutAddress();
    checkoutNote.textContent = "";
    document.querySelector('input[name="fulfillment"][value="delivery"]').checked = true;
    deliveryAddressFields.hidden = false;
    pickupInfo.hidden = true;
    checkoutModal.hidden = false;
}

async function confirmCheckout() {
    const cart = getCart();
    if (!cart.length) return;
    const fulfillment = document.querySelector('input[name="fulfillment"]:checked')?.value || "delivery";
    const address = readCheckoutAddress();
    if (fulfillment === "delivery" && (!address.recipient || !address.zip || !address.street || !address.city || !address.state)) { checkoutNote.textContent = "Preencha os dados obrigatórios de entrega."; return; }
    if (fulfillment === "pickup" && getCartStores().some(store => !store.location?.sector || !store.location?.street || !store.location?.box)) { checkoutNote.textContent = "Uma das lojas deste carrinho ainda não informou o box para retirada."; return; }
    const coupons = getClientCoupons();
    const couponResult = getCouponsDiscount(coupons, cart);
    checkoutButton.disabled = true;
    document.getElementById("confirmCheckout").disabled = true;
    if (fulfillment === "delivery" && document.getElementById("saveDeliveryAddress").checked) {
        const updatedSession = { ...session, deliveryAddress: address };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
        Object.assign(session, updatedSession);
    }
    let completedOrder;
    if (API_ENABLED) {
        const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: session.id, clientName: session.name || "Cliente", fulfillment, deliveryAddress: fulfillment === "delivery" ? address : null, pickupLocations: fulfillment === "pickup" ? getCartStores() : [], coupons: coupons.map(coupon => ({ code: coupon.code, campaignId: coupon.id, discount: Number(coupon.discount || 0) })), items: cart.map(entry => ({ productId: entry.productId, variationId: entry.variationId || null, quantity: entry.quantity })) }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { checkoutNote.textContent = data.error || data.mensagem || "Não foi possível finalizar o pedido."; checkoutButton.disabled = false; document.getElementById("confirmCheckout").disabled = false; renderCart(); return; }
        completedOrder = data.order;
        catalogProducts = data.products || catalogProducts;
    } else {
        const products = readProducts();
        for (const item of cart) {
            const product = products.find(entry => String(entry.id) === String(item.productId));
            const variation = getVariation(product, item.variationId);
            const stock = variation ? Number(variation.quantity || 0) : Number(product?.quantity || 0);
            if (!product || stock < item.quantity) { noteElement.textContent = "Estoque insuficiente para finalizar o pedido."; checkoutButton.disabled = false; return; }
            if (variation) variation.quantity -= item.quantity;
            product.quantity -= item.quantity;
            product.salesCount = Number(product.salesCount || 0) + item.quantity;
        }
        saveProducts(products);
        const localItems = cart.map(item => { const product = products.find(entry => String(entry.id) === String(item.productId)); const quantity = Number(item.quantity || 0); return { productId: item.productId, variationId: item.variationId || null, variation: getVariation(product, item.variationId), name: product?.name, ownerName: product?.ownerName, price: getProductUnitPrice(product, quantity), originalPrice: Number(product?.price || 0), quantity: item.quantity, promotion: getBulkPromotion(product?.id, quantity) }; });
        completedOrder = { id: `local-${Date.now()}`, clientName: session.name || "Cliente", fulfillment, deliveryAddress: fulfillment === "delivery" ? address : null, pickupLocations: fulfillment === "pickup" ? getCartStores() : [], items: localItems, subtotal: couponResult.subtotal, discount: couponResult.discount, total: couponResult.total,
                coupons: coupons.map(coupon => ({ code: coupon.code, discount: Number(coupon.discount || 0) })),
                createdAt: Date.now() };
    }
    cart.forEach(item => savePurchase(item.productId));
    saveCart([]);
    noteElement.textContent = "Compra finalizada com sucesso.";
    checkoutModal.hidden = true;
    document.getElementById("confirmCheckout").disabled = false;
    checkoutButton.disabled = false;
    cartPanel.hidden = true;
    renderCart();
    render();
    window.lastCompletedOrder = completedOrder;
    receiptSummary.textContent = `Pedido #${String(completedOrder.id).slice(0, 8).toUpperCase()} confirmado. Baixe a nota ou imprima para guardar seu comprovante.`;
    orderReceiptModal.hidden = false;
}

function readMedia(file) {
    return new Promise(resolve => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve({ type: file.type, data: reader.result, name: file.name });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

async function submitRating(productId, value, file) {
    if (value < 1 || value > 5) return;
    const media = await readMedia(file);
    if (API_ENABLED) {
        fetch(`/api/products/${encodeURIComponent(productId)}/ratings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: session.id, value, media }) })
            .then(response => { if (!response.ok) throw new Error("Avaliacao indisponivel"); return response.json(); })
            .then(data => {
                catalogProducts = catalogProducts.map(product => product.id === data.product.id ? data.product : product);
                noteElement.textContent = "Avaliação registrada com sucesso.";
                render();
            })
            
            .catch(() => { noteElement.textContent = "Não foi possível registrar a avaliação agora."; });
        return;
    }
    const products = readProducts();
    const product = products.find(item => String(item.id) === String(productId));
    if (!product) return;
    product.ratings = Array.isArray(product.ratings) ? product.ratings : [];
    const existing = product.ratings.find(rating => String(rating.clientId) === String(session.id));
    if (existing) { existing.value = value; existing.media = media; }
    else product.ratings.push({ clientId: session.id, value, media, createdAt: Date.now() });
    saveProducts(products);
    noteElement.textContent = "Avaliação registrada com sucesso.";
    render();
}
function sellerPreviewMarkup(ownerId) {
    const products = readProducts().filter(item => String(item.ownerId) === String(ownerId));
    const highlights = getStoreHighlights(ownerId);
    const localStores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    const store = catalogStores[ownerId] || localStores[ownerId] || {};
    const name = store.name || storeNameFor(ownerId);
    const cardList = list => list.length ? list.map(productCardMarkup).join("") : `<div class="seller-preview-empty">${list === highlights ? "Nenhum produto foi escolhido como destaque." : "Este vendedor ainda não possui produtos cadastrados."}</div>`;
    return `<section class="seller-preview" data-seller-owner-id="${escapeHtml(ownerId)}"><div class="seller-preview-heading"><div><p class="eyebrow">NA LOJA</p><h3>${escapeHtml(name)}</h3><small>${products.length} produto${products.length === 1 ? "" : "s"} no catálogo</small></div><button type="button" class="seller-view-store" data-open-full-store="${escapeHtml(ownerId)}">Ver loja</button></div><div class="seller-preview-tabs" role="tablist"><button type="button" class="seller-preview-tab active" data-seller-tab="highlights">★ Meus destaques <span>${highlights.length}</span></button><button type="button" class="seller-preview-tab" data-seller-tab="products">Todos os produtos <span>${products.length}</span></button></div><div class="seller-preview-panel" data-seller-panel="highlights"><div class="seller-preview-grid">${cardList(highlights)}</div></div><div class="seller-preview-panel" data-seller-panel="products" hidden><div class="seller-preview-grid">${cardList(products)}</div></div></section>`;
}

function bindSellerPreview() {
    const root = productDetailsContent.querySelector(".seller-preview");
    if (!root) return;
    root.querySelectorAll(".seller-preview-tab").forEach(tab => tab.addEventListener("click", () => {
        root.querySelectorAll(".seller-preview-tab").forEach(item => item.classList.toggle("active", item === tab));
        root.querySelectorAll(".seller-preview-panel").forEach(panel => panel.hidden = panel.dataset.sellerPanel !== tab.dataset.sellerTab);
    }));
    root.querySelectorAll("[data-store-product-id]").forEach(card => card.addEventListener("click", () => openProductDetails(card.dataset.storeProductId)));
    root.querySelector("[data-open-full-store]")?.addEventListener("click", () => { productDetailsModal.hidden = true; openStoreView(root.dataset.sellerOwnerId); });
}

function getLoyaltyBenefitsForProduct(product) {
    if (!product || !Array.isArray(serverLoyaltyCards)) return [];
    return serverLoyaltyCards.filter(card => {
        if (String(card.ownerId) !== String(product.ownerId)) return false;
        if (card.validade && new Date(`${card.validade}T23:59:59`) < new Date()) return false;
        if (card.scope === "category") return String(product.category || "") === String(card.category || "");
        if (card.scope === "product") return Array.isArray(card.productIds) && card.productIds.map(String).includes(String(product.id));
        return true;
    }).map(card => ({ ...card, pointsPerItem: Math.max(1, Math.floor(Number(card.pointsPerItem || 1))) }));
}

function loyaltyProductMarkup(product) {
    const benefits = getLoyaltyBenefitsForProduct(product);
    if (!benefits.length) return "";
    return `<div class="product-loyalty-box"><strong>🎁 Este produto dá pontos</strong>${benefits.map(card => `<span>${escapeHtml(card.nome)}: <b>${card.pointsPerItem} ponto(s)</b> por unidade</span>`).join("")}</div>`;
}

function openProductDetails(productId) {
    const product = readProducts().find(item => String(item.id) === String(productId));
    if (!product) return;
    const ratings = Array.isArray(product.ratings) ? product.ratings : [];
    const reviews = ratings.length ? ratings.map(rating => `<article class="review"><p>${"★".repeat(Number(rating.value))}${"☆".repeat(5 - Number(rating.value))}</p>${rating.media?.type?.startsWith("video/") ? `<video class="review-media" controls src="${escapeHtml(rating.media.data)}"></video>` : rating.media?.data ? `<img class="review-media" src="${escapeHtml(rating.media.data)}" alt="Mídia da avaliação">` : ""}</article>`).join("") : `<p class="details-description">Este produto ainda não possui avaliações.</p>`;
    const purchased = getPurchases().includes(String(product.id));
    const delivered = API_ENABLED ? deliveredPurchases.has(String(product.id)) : purchased;
    const cartQuantity = getCartQuantity(product.id);
    const variations = getVariations(product);
    const selectedVariation = variations.find(variation => getCartQuantity(product.id, variation.id) < Number(variation.quantity || 0)) || variations[0];
    const canAdd = selectedVariation ? getCartQuantity(product.id, selectedVariation.id) < Number(selectedVariation.quantity || 0) : cartQuantity < Number(product.quantity || 0);
    const variationOptions = variations.length ? `<div class="variation-choice"><strong>Escolha uma opção</strong><div class="variation-buttons" role="group" aria-label="Opções de cor e tamanho">${variations.map(variation => `<button class="variation-button ${variation.id === selectedVariation?.id ? "selected" : ""}" type="button" data-variation-id="${escapeHtml(variation.id)}" ${Number(variation.quantity || 0) < 1 ? "disabled" : ""}><span>${escapeHtml(variation.color)}</span><small>Tamanho ${escapeHtml(variation.size)} · ${Number(variation.quantity || 0)} disponíveis</small></button>`).join("")}</div></div>` : "";
    const selectedStock = selectedVariation ? Number(selectedVariation.quantity || 0) : Number(product.quantity || 0);
    const selectedInCart = selectedVariation ? getCartQuantity(product.id, selectedVariation.id) : cartQuantity;
    const quantityOptions = `<div class="quantity-choice"><div><strong>Quantidade</strong><small id="quantityStock">${Math.max(0, selectedStock - selectedInCart)} disponíveis</small></div><div class="quantity-control"><button id="quantityDecrease" type="button" aria-label="Diminuir quantidade">−</button><output id="purchaseQuantity" for="quantityDecrease quantityIncrease">1</output><button id="quantityIncrease" type="button" aria-label="Aumentar quantidade">+</button></div></div>`;
    const wholesale = product.wholesale && Number(product.wholesale.minQuantity) >= 2 ? `<div class="wholesale-box">🏷️ Atacado: a partir de ${Number(product.wholesale.minQuantity)} peças por R$ ${Number(product.wholesale.price).toFixed(2).replace(".", ",")} cada.</div>` : "";
    const localStores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    const storeLocation = catalogStores[product.ownerId]?.location || localStores[product.ownerId]?.location;
    const pickupLocation = storeLocation?.sector && storeLocation?.street && storeLocation?.box ? `<p class="pickup-location">📍 Retirada no Moda Center: Setor ${escapeHtml(storeLocation.sector)}, Rua ${escapeHtml(storeLocation.street)}, Box ${escapeHtml(storeLocation.box)}</p>` : "";
    productDetailsContent.innerHTML = `<h2 id="productDetailsTitle">${escapeHtml(product.name)}</h2><img class="details-product-image" src="${escapeHtml(product.image || PLACEHOLDER)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div class="details-meta"><span>${escapeHtml(product.category || "Produto")}</span><strong>R$ ${Number(product.price || 0).toFixed(2).replace(".", ",")}</strong><span>${Number(product.quantity || 0)} em estoque</span></div>${pickupLocation}<p class="details-description">${escapeHtml(product.description || "O vendedor ainda não adicionou uma descrição.")}</p>${loyaltyProductMarkup(product)}${variationOptions}${quantityOptions}${wholesale}<button id="detailsAddToCart" class="buy-button" type="button" ${canAdd ? "" : "disabled"}>${cartQuantity ? `Adicionar mais (${cartQuantity} no carrinho)` : "Adicionar ao carrinho"}</button><a class="chat-button" href="../../Comerciante/pages/chat_comerciante.html?merchant=${encodeURIComponent(product.ownerId)}">Conversar com a loja</a>${sellerPreviewMarkup(product.ownerId)}<h3 class="reviews-title">Avaliações (${ratings.length})</h3><div>${reviews}</div>${delivered ? `<div class="review-form"><strong>Deixe sua avaliação</strong><select id="detailsRating"><option value="">Escolha de 1 a 5 estrelas</option><option value="1">1 estrela</option><option value="2">2 estrelas</option><option value="3">3 estrelas</option><option value="4">4 estrelas</option><option value="5">5 estrelas</option></select><input id="detailsReviewMedia" type="file" accept="image/*,video/*"><button id="detailsRatingButton" class="rating-button" type="button">Enviar avaliação</button></div>` : purchased ? `<p class="review-waiting">A avaliação ficará disponível após a entrega.</p>` : ""}`;
    productDetailsModal.hidden = false;
    bindSellerPreview();
    let selectedVariationId = selectedVariation?.id || null;
    let purchaseQuantity = 1;
    const updatePurchaseControls = () => {
        const currentVariation = getVariation(product, selectedVariationId);
        const available = Math.max(0, (currentVariation ? Number(currentVariation.quantity || 0) : Number(product.quantity || 0)) - getCartQuantity(product.id, selectedVariationId));
        purchaseQuantity = Math.min(Math.max(1, purchaseQuantity), Math.max(1, available));
        document.getElementById("purchaseQuantity").textContent = purchaseQuantity;
        document.getElementById("quantityStock").textContent = `${available} disponíveis`;
        document.getElementById("detailsAddToCart").disabled = available < 1;
    };
    productDetailsContent.querySelectorAll(".variation-button").forEach(button => button.addEventListener("click", () => {
        selectedVariationId = button.dataset.variationId;
        productDetailsContent.querySelectorAll(".variation-button").forEach(item => item.classList.toggle("selected", item === button));
        updatePurchaseControls();
    }));
    document.getElementById("quantityDecrease")?.addEventListener("click", () => { purchaseQuantity = Math.max(1, purchaseQuantity - 1); updatePurchaseControls(); });
    document.getElementById("quantityIncrease")?.addEventListener("click", () => { purchaseQuantity += 1; updatePurchaseControls(); });
    updatePurchaseControls();
    document.getElementById("detailsAddToCart")?.addEventListener("click", () => { productDetailsModal.hidden = true; buyProduct(product.id, selectedVariationId, purchaseQuantity); });
    document.getElementById("detailsRatingButton")?.addEventListener("click", () => submitRating(product.id, Number(document.getElementById("detailsRating").value), document.getElementById("detailsReviewMedia").files[0]));
}

searchElement.addEventListener("input", render);
cartButton.addEventListener("click", () => { renderCart(); cartPanel.hidden = false; });
document.getElementById("closeCart").addEventListener("click", () => { cartPanel.hidden = true; });
document.getElementById("continueShopping").addEventListener("click", () => { cartPanel.hidden = true; });
checkoutButton.addEventListener("click", checkoutCart);
document.getElementById("confirmCheckout").addEventListener("click", confirmCheckout);
applyCouponButton?.addEventListener("click", applyCoupon);
removeCouponButton?.addEventListener("click", clearCoupon);
couponInput?.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(); } });
document.getElementById("closeReceipt").addEventListener("click", () => { orderReceiptModal.hidden = true; });
document.getElementById("downloadReceipt").addEventListener("click", () => { if (window.OrderReceipt?.download) window.OrderReceipt.download(window.lastCompletedOrder, "cliente"); });
document.getElementById("printReceipt").addEventListener("click", () => { if (window.OrderReceipt?.print) window.OrderReceipt.print(window.lastCompletedOrder, "cliente"); });
orderReceiptModal.addEventListener("click", event => { if (event.target === orderReceiptModal) orderReceiptModal.hidden = true; });
document.getElementById("styleAssistantButton")?.addEventListener("click", openLookStudio);
document.getElementById("lookGeneratorButton")?.addEventListener("click", openLookStudio);
document.getElementById("magicMirrorButton")?.addEventListener("click", () => { magicMirrorModal.hidden = false; });
document.getElementById("closeStyleStudio")?.addEventListener("click", () => { styleStudioModal.hidden = true; });
document.getElementById("closeMagicMirror")?.addEventListener("click", () => { magicMirrorModal.hidden = true; });
document.querySelectorAll(".style-studio-modal").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) modal.hidden = true; }));
lookForm?.addEventListener("submit", event => {
    event.preventDefault();
    const occasion = document.getElementById("lookOccasion").value;
    const style = document.getElementById("lookStyle").value;
    const preference = document.getElementById("lookPreference").value.trim();
    const budget = Number(document.getElementById("lookBudget").value || 0);
    saveStylePreferences({ occasion, style, preference, budget });
    renderLookResult(chooseLookProducts(occasion, style, preference, budget), occasion, style);
});
document.getElementById("mirrorPhotoInput")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { mirrorPhoto.src = reader.result; mirrorPhoto.hidden = false; saveMirrorPhotoButton.disabled = false; mirrorStage.querySelector(".mirror-placeholder")?.remove(); };
    reader.readAsDataURL(file);
});
document.getElementById("mirrorOpenLook")?.addEventListener("click", () => { magicMirrorModal.hidden = true; openLookStudio(); });
saveMirrorPhotoButton?.addEventListener("click", saveMirrorPhoto);
document.getElementById("closeCheckout").addEventListener("click", () => { checkoutModal.hidden = true; });
document.querySelectorAll('input[name="fulfillment"]').forEach(input => input.addEventListener("change", () => { const pickup = input.value === "pickup" && input.checked; deliveryAddressFields.hidden = pickup; pickupInfo.hidden = !pickup; if (pickup) { const stores = getCartStores(); pickupInfo.innerHTML = `<strong>Locais de retirada</strong>${stores.map(store => `<span>📍 ${escapeHtml(store.name)}: Setor ${escapeHtml(store.location?.sector || "não informado")}, Rua ${escapeHtml(store.location?.street || "-")}, Box ${escapeHtml(store.location?.box || "-")}</span>`).join("")}`; } }));
checkoutModal.addEventListener("click", event => { if (event.target === checkoutModal) checkoutModal.hidden = true; });
document.getElementById("closeProductDetails").addEventListener("click", () => { productDetailsModal.hidden = true; });
document.getElementById("closeStoreView")?.addEventListener("click", () => { storeViewModal.hidden = true; });
storeViewModal?.addEventListener("click", event => { if (event.target === storeViewModal) storeViewModal.hidden = true; });
productDetailsModal.addEventListener("click", event => { if (event.target === productDetailsModal) productDetailsModal.hidden = true; });
render();
renderCart();
loadCatalog();
syncCoupons();
if (API_ENABLED) window.setInterval(loadCatalog, 5000);
if (API_ENABLED) window.setInterval(syncCoupons, 10000);
