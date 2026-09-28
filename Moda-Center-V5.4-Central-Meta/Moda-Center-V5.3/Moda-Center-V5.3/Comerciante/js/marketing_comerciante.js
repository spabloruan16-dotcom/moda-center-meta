// =========================================================
// CENTRAL DE MARKETING (marketing_comerciante.html)
// =========================================================
// Esta tela ainda é só uma vitrine: nenhuma das ferramentas
// (cupons, promoções, lives, etc.) tem uma página própria
// implementada. Por isso, ao clicar em qualquer card, damos um
// retorno visual (animação) e um aviso "em desenvolvimento",
// em vez de deixar o clique sem nenhuma resposta.
// =========================================================

const toast = document.getElementById("toast");
const session = window.comercianteSession;
const PRODUCTS_KEY = "modaCenterProducts";
const CAMPAIGNS_KEY = "modaCenterCampaigns";
const BULK_PROMOTIONS_KEY = "modaCenterBulkPromotions";
const campaignBackdrop = document.getElementById("campaignBackdrop");
const campaignForm = document.getElementById("campaignForm");
const campaignList = document.getElementById("campaignList");
const campaignCount = document.getElementById("campaignCount");
const campaignScope = document.getElementById("campaignScope");
const campaignCategory = document.getElementById("campaignCategory");
const campaignProduct = document.getElementById("campaignProduct");
const campaignCategoryField = document.getElementById("campaignCategoryField");
const campaignProductField = document.getElementById("campaignProductField");
const flashFields = document.getElementById("flashFields");
const couponFields = document.getElementById("couponFields");
const couponValidity = document.getElementById("couponValidity");
const bulkFields = document.getElementById("bulkFields");
const bulkProducts = document.getElementById("bulkProducts");
const bulkMinUnits = document.getElementById("bulkMinUnits");
const campaignScopeField = document.getElementById("campaignScopeField");
const campaignNote = document.getElementById("campaignNote");
const highlightsBackdrop = document.getElementById("highlightsBackdrop");
const highlightsForm = document.getElementById("highlightsForm");
const highlightProduct = document.getElementById("highlightProduct");
const highlightSearch = document.getElementById("highlightSearch");
const highlightPickerButton = document.getElementById("highlightPickerButton");
const highlightPickerPanel = document.getElementById("highlightPickerPanel");
const highlightProductList = document.getElementById("highlightProductList");
const highlightPickerImage = document.getElementById("highlightPickerImage");
const highlightPickerName = document.getElementById("highlightPickerName");
const highlightPickerMeta = document.getElementById("highlightPickerMeta");
const highlightPreview = document.getElementById("highlightPreview");
const highlightsNote = document.getElementById("highlightsNote");
const HIGHLIGHTS_KEY = "modaCenterHighlights";
const API_ENABLED = window.location.protocol !== "file:";


function readProducts() {
	const all = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
	return Array.isArray(all[session?.id]) ? all[session.id] : [];
}

function readCampaigns() {
	const all = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || "{}");
	return Array.isArray(all[session?.id]) ? all[session.id] : [];
}

function saveCampaigns(campaigns) {
	const all = JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || "{}");
	all[session.id] = campaigns;
	localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(all));
}

// =========================================================
// PROMOÇÕES "LEVE MAIS POR MENOS"
// =========================================================
// Mantém as promoções em uma estrutura própria para que outras
// telas/scripts possam consultar as ofertas sem depender apenas
// dos dados dos produtos.
function readBulkPromotions() {
	const all = JSON.parse(localStorage.getItem(BULK_PROMOTIONS_KEY) || "{}");
	return Array.isArray(all[session?.id]) ? all[session.id] : [];
}

function saveBulkPromotions(promotions) {
	const all = JSON.parse(localStorage.getItem(BULK_PROMOTIONS_KEY) || "{}");
	all[session.id] = promotions;
	localStorage.setItem(BULK_PROMOTIONS_KEY, JSON.stringify(all));
	window.promocoesLeveMais = promotions;
}

// Disponibiliza as promoções para outros arquivos JS da aplicação.
window.promocoesLeveMais = readBulkPromotions();
function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function campaignScopeLabel(campaign) {
	if (campaign.type === "bulk") return `${campaign.minUnits} unidades · ${campaign.productCount || 0} produto(s)`;
	return campaign.scope === "all" ? "Todos os produtos" : campaign.scope === "category" ? `Categoria: ${campaign.category}` : `Produto: ${campaign.productName}`;
}
function renderCampaigns() {
	const campaigns = readCampaigns();
	campaignCount.textContent = campaigns.length;
	campaignList.innerHTML = campaigns.length ? campaigns.map(campaign => {
        if (campaign.type === "coupon") {
            return `<article class="campaign-item coupon-item">
                <span class="campaign-type coupon-type">🎫 Cupom</span>
                <div class="campaign-main">
                    <strong>${escapeHtml(campaign.name)}</strong>
                    <div class="coupon-code-display">${escapeHtml(campaign.code)}</div>
                    <small>${campaign.discount}% OFF · ${escapeHtml(campaignScopeLabel(campaign))}</small>
                    <small>${campaign.limit ? `Limite: ${campaign.limit} uso(s)` : "Usos ilimitados"}</small>
                    ${campaign.end ? `<small>Válido até ${new Date(campaign.end).toLocaleString("pt-BR")}</small>` : `<small>Sem data de encerramento</small>`}
                </div>
                <button type="button" data-campaign-id="${escapeHtml(campaign.id)}" aria-label="Remover cupom">×</button>
            </article>`;
        }
        return `<article class="campaign-item"><span class="campaign-type">${campaign.type === "flash" ? "⚡ Relâmpago" : campaign.type === "bulk" ? "🛍 Leve Mais" : "% Promoção"}</span><div><strong>${escapeHtml(campaign.name)}</strong><small>${campaign.discount}% OFF · ${escapeHtml(campaignScopeLabel(campaign))}</small>${campaign.type === "flash" ? `<small>${campaign.untilStock ? "Até o estoque acabar" : `${campaign.start ? new Date(campaign.start).toLocaleString("pt-BR") : "Agora"} até ${campaign.end ? new Date(campaign.end).toLocaleString("pt-BR") : "sem fim"}`}</small>` : ""}</div><button type="button" data-campaign-id="${escapeHtml(campaign.id)}" aria-label="Remover campanha">×</button></article>`;
    }).join("") : '<p class="campaign-empty">Nenhuma campanha criada ainda.</p>';
	campaignList.querySelectorAll("button[data-campaign-id]").forEach(button => button.addEventListener("click", () => {
		const products = readProducts();
		const campaignId = button.dataset.campaignId;
		const currentCampaigns = readCampaigns();
		const removedCampaign = currentCampaigns.find(campaign => campaign.id === campaignId);
		const campaigns = currentCampaigns.filter(campaign => campaign.id !== campaignId);

		// Remove também os dados da promoção dos produtos participantes.
		if (removedCampaign?.type === "bulk") {
			products.forEach(product => {
				if (removedCampaign.productIds?.includes(String(product.id))) {
					delete product.bulkOffer;
					if (product.campaignId === removedCampaign.name) {
						delete product.campaignId;
					}
				}
			});
		}

		localStorage.setItem(PRODUCTS_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}"), [session.id]: products }));
		saveCampaigns(campaigns);
		saveBulkPromotions(readBulkPromotions().filter(promotion => promotion.id !== campaignId));
		renderCampaigns();
		showToast("Campanha removida.");
	}));
}


function fillCampaignTargets() {
	const products = readProducts();
	const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
	campaignCategory.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
	campaignProduct.innerHTML = products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`).join("");
	bulkProducts.innerHTML = products.length ? products.map(product => `<label class="bulk-product-option"><input type="checkbox" value="${escapeHtml(product.id)}"><span>${escapeHtml(product.name)}</span></label>`).join("") : '<p class="campaign-empty">Nenhum produto cadastrado.</p>';
}

function openCampaign(type) {
	campaignForm.reset();
    const isCoupon = type === "coupon";
	document.getElementById("campaignTitle").textContent = isCoupon ? "Criar cupom" : type === "flash" ? "Criar oferta relâmpago" : type === "bulk" ? "Leve Mais por Menos" : "Criar promoção";
	document.getElementById("campaignEyebrow").textContent = isCoupon ? "NOVO CUPOM" : type === "flash" ? "OFERTA POR TEMPO LIMITADO" : type === "bulk" ? "PROMOÇÃO POR QUANTIDADE" : "NOVA CAMPANHA";
	campaignForm.dataset.type = type;
	fillCampaignTargets();
	campaignNote.textContent = "";
	flashFields.hidden = type !== "flash";
	bulkFields.hidden = type !== "bulk";
    if (couponFields) couponFields.hidden = !isCoupon;
    if (couponValidity) couponValidity.hidden = !isCoupon;
	campaignScopeField.hidden = type === "bulk";
	if (type === "bulk") { bulkMinUnits.value = 2; }
	campaignBackdrop.hidden = false;
	campaignScope.dispatchEvent(new Event("change"));
}

function closeCampaign() { campaignBackdrop.hidden = true; }
function readHighlights() {
	const all = JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) || "{}");
	return Array.isArray(all[session?.id]) ? all[session.id] : [];
}

function saveHighlights(highlights) {
	const all = JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) || "{}");
	all[session.id] = highlights;
	localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(all));
}

function renderSavedHighlights() {
	const products = readProducts();
	const highlights = readHighlights();
	const saved = highlights.map(item => products.find(product => String(product.id) === String(item.productId))).filter(Boolean);
	const count = document.getElementById("highlightCount");
	const list = document.getElementById("savedHighlights");
	if (count) count.textContent = saved.length;
	if (!list) return;
	list.innerHTML = saved.length ? saved.map(product => `<article class="saved-highlight-item"><img src="${escapeHtml(product.image || "../../assets/images/produtos/sem-foto.svg")}" alt=""><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "Produto")}</small></div><button type="button" data-remove-highlight="${escapeHtml(product.id)}" aria-label="Remover ${escapeHtml(product.name)}">×</button></article>`).join("") : `<div class="saved-highlights-empty"><span>☆</span><p>Nenhum produto em destaque ainda.</p></div>`;
	list.querySelectorAll("[data-remove-highlight]").forEach(button => button.addEventListener("click", async () => {
		const id = String(button.dataset.removeHighlight);
		const highlights = readHighlights().filter(item => String(item.productId) !== id);
		saveHighlights(highlights);
		const products = readProducts();
		const product = products.find(item => String(item.id) === id);
		if (product) product.highlighted = false;
		const allProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
		allProducts[session.id] = products;
		localStorage.setItem(PRODUCTS_KEY, JSON.stringify(allProducts));
		if (API_ENABLED && product) fetch(`/api/products/${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: session.id, highlighted: false }) }).catch(() => {});
		renderSavedHighlights();
		showToast("Produto removido dos destaques.");
	}));
}

function getHighlightCandidates() {
	const products = readProducts();
	const highlightedIds = new Set(readHighlights().map(item => String(item.productId)));
	return products.filter(product => !highlightedIds.has(String(product.id)));
}

function renderHighlightPreview() {
	if (!highlightPreview) return;
	const products = getHighlightCandidates();
	const product = products.find(item => String(item.id) === String(highlightProduct?.value));
	if (!product) {
		highlightPreview.innerHTML = `<div class="highlight-preview-empty">Selecione um produto para visualizar como ele ficará nos destaques.</div>`;
		if (highlightPickerImage) highlightPickerImage.src = "../../assets/images/produtos/sem-foto.svg";
		if (highlightPickerName) highlightPickerName.textContent = "Selecionar produto";
		if (highlightPickerMeta) highlightPickerMeta.textContent = "Clique para escolher um produto";
		return;
	}
	const finalPrice = Number(product.price || 0) * (1 - Number(product.discount || 0) / 100);
	const image = product.image || "../../assets/images/produtos/sem-foto.svg";
	if (highlightPickerImage) {
		highlightPickerImage.src = image;
		highlightPickerImage.onerror = () => { highlightPickerImage.src = "../../assets/images/produtos/sem-foto.svg"; };
	}
	if (highlightPickerName) highlightPickerName.textContent = product.name || "Produto";
	if (highlightPickerMeta) highlightPickerMeta.textContent = `${product.category || "Produto"} • R$ ${finalPrice.toFixed(2).replace(".", ",")}`;
	highlightPreview.innerHTML = `<div class="highlight-preview-card"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='../../assets/images/produtos/sem-foto.svg'"><div><p>PREVIEW DO DESTAQUE</p><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "Produto")}</small><b>R$ ${finalPrice.toFixed(2).replace(".", ",")}</b></div></div>`;
}

function renderHighlightProductOptions() {
	const products = getHighlightCandidates();
	const search = String(highlightSearch?.value || "").trim().toLowerCase();
	const filtered = products.filter(product => `${product.name || ""} ${product.category || ""}`.toLowerCase().includes(search));
	const current = String(highlightProduct?.value || "");
	if (highlightProductList) {
		highlightProductList.innerHTML = filtered.length ? filtered.map(product => {
			const finalPrice = Number(product.price || 0) * (1 - Number(product.discount || 0) / 100);
			const image = product.image || "../../assets/images/produtos/sem-foto.svg";
			const selected = String(product.id) === current ? " selected" : "";
			return `<button type="button" class="highlight-product-option${selected}" data-highlight-product-id="${escapeHtml(product.id)}" role="option" aria-selected="${String(product.id) === current}"><img src="${escapeHtml(image)}" alt="" onerror="this.onerror=null;this.src='../../assets/images/produtos/sem-foto.svg'"><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "Produto")}</small></span><b>R$ ${finalPrice.toFixed(2).replace(".", ",")}</b></button>`;
		}).join("") : `<div class="highlight-product-empty"><span>⌕</span><strong>Nenhum produto encontrado</strong><small>Tente pesquisar por outro nome ou categoria.</small></div>`;
		highlightProductList.querySelectorAll("[data-highlight-product-id]").forEach(button => button.addEventListener("click", () => {
			highlightProduct.value = button.dataset.highlightProductId;
			renderHighlightProductOptions();
			renderHighlightPreview();
			closeHighlightPicker();
		}));
	}
	const saveButton = highlightsForm?.querySelector(".campaign-save");
	if (saveButton) saveButton.disabled = !highlightProduct?.value || !getHighlightCandidates().length;
	renderHighlightPreview();
}

function openHighlightPicker() {
	if (!highlightPickerPanel) return;
	highlightPickerPanel.hidden = false;
	highlightPickerButton?.setAttribute("aria-expanded", "true");
	if (highlightSearch) { highlightSearch.value = ""; highlightSearch.focus(); }
	renderHighlightProductOptions();
}

function closeHighlightPicker() {
	if (!highlightPickerPanel) return;
	highlightPickerPanel.hidden = true;
	highlightPickerButton?.setAttribute("aria-expanded", "false");
}

function openHighlights() {
	if (highlightProduct) highlightProduct.value = "";
	closeHighlightPicker();
	renderHighlightProductOptions();
	const products = readProducts();
	const highlightedIds = new Set(readHighlights().map(item => String(item.productId)));
	highlightsNote.textContent = products.length ? (highlightedIds.size >= products.length ? "Todos os produtos já estão em destaque." : "Pesquise e selecione um produto para visualizar o destaque.") : "Cadastre um produto antes de criar um destaque.";
	highlightsForm.querySelector(".campaign-save").disabled = !getHighlightCandidates().length;
	renderSavedHighlights();
	highlightsBackdrop.hidden = false;
}

function closeHighlights() { highlightsBackdrop.hidden = true; }

campaignScope?.addEventListener("change", () => {
	const scope = campaignScope.value;
	campaignCategoryField.hidden = scope !== "category";
	campaignProductField.hidden = scope !== "product";
});

document.getElementById("promotionsCard")?.addEventListener("click", () => openCampaign("promotion"));
document.getElementById("flashOffersCard")?.addEventListener("click", () => openCampaign("flash"));
document.getElementById("cuponsCard")?.addEventListener("click", () => openCampaign("coupon"));
document.getElementById("highlightsCard")?.addEventListener("click", openHighlights);
document.getElementById("closeHighlights")?.addEventListener("click", closeHighlights);
highlightSearch?.addEventListener("input", renderHighlightProductOptions);
highlightPickerButton?.addEventListener("click", () => {
		if (highlightPickerPanel?.hidden) openHighlightPicker();
		else closeHighlightPicker();
});
document.addEventListener("click", event => {
	if (!highlightPickerPanel || highlightPickerPanel.hidden) return;
	if (!event.target.closest(".highlight-picker-label")) closeHighlightPicker();
});
highlightsBackdrop?.addEventListener("click", event => { if (event.target === highlightsBackdrop) closeHighlights(); });
document.getElementById("bulkOffersCard")?.addEventListener("click", () => openCampaign("bulk"));
document.getElementById("closeCampaign")?.addEventListener("click", closeCampaign);
document.getElementById("couponCode")?.addEventListener("input", event => { event.target.value = event.target.value.replace(/[^A-Za-z0-9_-]/g, ""); });
campaignBackdrop?.addEventListener("click", event => { if (event.target === campaignBackdrop) closeCampaign(); });

highlightsForm?.addEventListener("submit", event => {
	event.preventDefault();
	const products = readProducts();
	const product = products.find(item => String(item.id) === String(highlightProduct.value));
	if (!product) { highlightsNote.textContent = "Cadastre um produto antes de criar um destaque."; return; }
	const highlights = readHighlights().filter(item => String(item.productId) !== String(product.id));
	highlights.push({ id: `${Date.now()}`, productId: product.id, productName: product.name });
	saveHighlights(highlights);
	product.highlighted = true;
	const allProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
	allProducts[session.id] = products;
	localStorage.setItem(PRODUCTS_KEY, JSON.stringify(allProducts));
	if (API_ENABLED) fetch(`/api/products/${encodeURIComponent(product.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: session.id, highlighted: true }) }).catch(() => {});
	openHighlights();
	showToast(`${product.name} foi adicionado aos destaques.`);
});

campaignForm?.addEventListener("submit", async event => {
	event.preventDefault();
	const products = readProducts();
	const name = document.getElementById("campaignName").value.trim();
	const discount = Number(document.getElementById("campaignDiscount").value);
	const scope = campaignScope.value;
	const category = campaignCategory.value;
	const productId = campaignProduct.value;
	const type = campaignForm.dataset.type;
	const minUnits = Number(bulkMinUnits.value);
	const bulkProductIds = [...bulkProducts.querySelectorAll('input[type="checkbox"]:checked')].map(input => String(input.value));
    if (type === "coupon") {
        const code = document.getElementById("couponCode")?.value.trim() || "";
        const startCoupon = document.getElementById("couponStart")?.value || "";
        const endCoupon = document.getElementById("couponEnd")?.value || "";
        const limitValue = document.getElementById("couponLimit")?.value || "";
        const limit = limitValue ? Number(limitValue) : null;
        if (!code || code.length < 3) { campaignNote.textContent = "O código precisa ter pelo menos 3 caracteres."; return; }
        const campaigns = readCampaigns();
        if (campaigns.some(c => c.type === "coupon" && c.code === code)) { campaignNote.textContent = "Esse código de cupom já está sendo usado."; return; }
        if (startCoupon && endCoupon && new Date(endCoupon) <= new Date(startCoupon)) { campaignNote.textContent = "O término precisa ser depois do início."; return; }
        if (limit !== null && limit < 1) { campaignNote.textContent = "O limite de usos precisa ser maior que zero."; return; }
        const selectedProducts = products.filter(product => scope === "all" || (scope === "category" ? product.category === category : String(product.id) === String(productId)));
        if (!selectedProducts.length) { campaignNote.textContent = "Nenhum produto encontrado para este cupom."; return; }
        const coupon = { id: `${Date.now()}`, type: "coupon", name, code, discount, scope, category, productId, productName: selectedProducts[0]?.name || "", start: startCoupon, end: endCoupon, limit, used: 0, active: true, ownerId: session.id };
        campaigns.push(coupon);
        saveCampaigns(campaigns);
        if (API_ENABLED) {
            try {
                const response = await fetch("/api/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(coupon) });
                if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Não foi possível salvar o cupom no servidor"); }
            } catch (error) {
                campaigns.splice(campaigns.indexOf(coupon), 1); saveCampaigns(campaigns); campaignNote.textContent = error.message; return;
            }
        }
        renderCampaigns();
        closeCampaign();
        showToast("Cupom criado com sucesso.");
        return;
    }
	const start = document.getElementById("flashStart").value;
	const end = document.getElementById("flashEnd").value;
	const untilStock = document.getElementById("flashUntilStock").checked;
	if (!products.length) { campaignNote.textContent = "Cadastre um produto antes de criar uma campanha."; return; }
	if (type === "bulk" && (!Number.isInteger(minUnits) || minUnits < 2)) { campaignNote.textContent = "Informe uma quantidade mínima de 2 unidades."; return; }
	if (type === "bulk" && !bulkProductIds.length) { campaignNote.textContent = "Selecione pelo menos um produto."; return; }
	if (type === "flash" && !untilStock && start && end && new Date(end) <= new Date(start)) { campaignNote.textContent = "O término precisa ser depois do início."; return; }
	const selected = type === "bulk"
		? products.filter(product => bulkProductIds.includes(String(product.id)))
		: products.filter(product => scope === "all" || (scope === "category" ? product.category === category : String(product.id) === String(productId)));
	selected.forEach(product => {
		if (type !== "bulk") {
			product.discount = discount;
			product.campaignId = name;
		}
		if (type === "flash") product.flashOffer = { start: start || new Date().toISOString(), end: end || null, untilStock };
		if (type === "bulk") product.bulkOffer = { minUnits, discount, campaignId: name };
	});
	const allProducts = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "{}");
	allProducts[session.id] = products;
	localStorage.setItem(PRODUCTS_KEY, JSON.stringify(allProducts));
	const campaignId = `${Date.now()}`;
	const campaigns = readCampaigns();
	const campaign = { id: campaignId, name, discount, scope, category, productId, productName: selected[0]?.name || "", type, start, end, untilStock, minUnits: type === "bulk" ? minUnits : null, productIds: type === "bulk" ? bulkProductIds : [], productCount: selected.length };
	campaigns.push(campaign);
	saveCampaigns(campaigns);

	// Salva a promoção "Leve Mais por Menos" em JS/localStorage.
	// Assim ela continua disponível após recarregar a página e pode
	// ser consumida por outras telas do projeto.
	if (type === "bulk") {
		const promotions = readBulkPromotions();
		promotions.push({
			id: campaignId,
			name,
			discount,
			minUnits,
			productIds: [...bulkProductIds],
			productCount: selected.length,
			createdAt: new Date().toISOString()
		});
		saveBulkPromotions(promotions);
	}
	renderCampaigns();
	closeCampaign();
	showToast(`${type === "flash" ? "Oferta relâmpago" : type === "bulk" ? "Promoção Leve Mais" : "Promoção"} ativada para ${selected.length} produto(s).`);
});

renderCampaigns();




// =========================================================
// CARTÃO DE FIDELIDADE
// =========================================================

const fidelidadePopup = document.getElementById("premioPopup");
const cartoesListPopup = document.getElementById("cartoesListPopup");
const fecharPremioBtn = document.getElementById("fecharPremio");
const fecharListaCartoesBtn = document.getElementById("fecharListaCartoes");
const fidelidadeCardBtn = document.getElementById("fidelidadeCard");
const criarCartaoBtn = document.getElementById("criar");
const verCartoesBtn = document.getElementById("verCartoesBtn");
const mensagemCartao = document.getElementById("mensagem");
const cartoesListaEl = document.getElementById("cartoesFidelidadeLista");

const elsCriar = ["nomeCartao", "metaPontos", "recompensa", "descontoValor", "validade"]
    .reduce((acc, id) => { acc[id] = document.getElementById(id); return acc; }, {});
const escopoFidelidade = document.getElementById("escopoFidelidade");
const categoriaFidelidade = document.getElementById("categoriaFidelidade");
const categoriaFidelidadeField = document.getElementById("categoriaFidelidadeField");
const produtosFidelidade = document.getElementById("produtosFidelidade");
const produtosFidelidadeField = document.getElementById("produtosFidelidadeField");
const pontosPorItem = document.getElementById("pontosPorItem");

function preencherAlvosFidelidade() {
    const products = readProducts();
    const categories = [...new Set(products.map(product => String(product.category || "").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, "pt-BR"));
    if (categoriaFidelidade) categoriaFidelidade.innerHTML = categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    if (produtosFidelidade) {
        produtosFidelidade.innerHTML = products.length ? products.map(product => `<label><input type="checkbox" value="${escapeHtml(product.id)}"><span>${escapeHtml(product.name)}</span><small>${escapeHtml(product.category || "Produto")}</small></label>`).join("") : `<p class="campaign-empty">Nenhum produto cadastrado.</p>`;
    }
}

function atualizarAlvosFidelidade() {
    const scope = escopoFidelidade?.value || "all";
    if (categoriaFidelidadeField) categoriaFidelidadeField.hidden = scope !== "category";
    if (produtosFidelidadeField) produtosFidelidadeField.hidden = scope !== "product";
}

escopoFidelidade?.addEventListener("change", atualizarAlvosFidelidade);

fidelidadeCardBtn?.addEventListener("click", () => {
    preencherAlvosFidelidade();
    if (escopoFidelidade) escopoFidelidade.value = "all";
    if (pontosPorItem) pontosPorItem.value = "1";
    atualizarAlvosFidelidade();
    if (fidelidadePopup) fidelidadePopup.hidden = false;
});

fecharPremioBtn?.addEventListener("click", () => {
    if (fidelidadePopup) fidelidadePopup.hidden = true;
});

fidelidadePopup?.addEventListener("click", event => {
    if (event.target === fidelidadePopup) fidelidadePopup.hidden = true;
});

fecharListaCartoesBtn?.addEventListener("click", () => {
    if (cartoesListPopup) cartoesListPopup.hidden = true;
});

cartoesListPopup?.addEventListener("click", event => {
    if (event.target === cartoesListPopup) cartoesListPopup.hidden = true;
});

verCartoesBtn?.addEventListener("click", async () => {
    if (cartoesListPopup) {
        cartoesListPopup.hidden = false;
        await carregarCartoesFidelidade();
    }
});

async function excluirCartaoFidelidade(cartaoId) {
    try {
        const resposta = await fetch(`/api/loyalty-cards/${cartaoId}`, { method: "DELETE" });
        if (!resposta.ok) {
            const erro = await resposta.json();
            showToast(erro.error || "Erro ao excluir cartão.");
            return;
        }
        showToast("Cartão excluído com sucesso.");
        await carregarCartoesFidelidade();
    } catch (erro) {
        console.error("Erro ao excluir cartão fidelidade:", erro);
        showToast("Não foi possível excluir o cartão.");
    }
}

async function carregarCartoesFidelidade() {
    if (!cartoesListaEl) return;
    const sessao = JSON.parse(localStorage.getItem("modaCenterSession") || "null");
    const ownerId = sessao?.id;

    try {
        const resposta = await fetch("/api/loyalty-cards");
        const dados = await resposta.json();
        const todos = Array.isArray(dados.cartoes) ? dados.cartoes : [];
        const cartoes = ownerId ? todos.filter(c => String(c.ownerId) === String(ownerId)) : todos;

        if (cartoes.length === 0) {
            cartoesListaEl.innerHTML = '<p class="campaign-empty">Nenhum cartão criado ainda.</p>';
            return;
        }

        cartoesListaEl.innerHTML = cartoes.map(cartao => {
            const desconto = Number(cartao.descontoValor || 0).toFixed(2).replace(".", ",");
            const validade = cartao.validade
                ? `<p>Validade: ${escapeHtml(cartao.validade)}</p>`
                : `<p>Sem data de validade</p>`;
            const regra = cartao.scope === "category" ? `Categoria: ${cartao.category}` : cartao.scope === "product" ? `Produtos selecionados: ${(cartao.productIds || []).length}` : "Todos os produtos";
            const pontos = Number(cartao.pointsPerItem || 1);
            return `
                <div class="campanha cartao-fidelidade-item">
                    <button type="button" class="excluir-cartao" data-cartao-id="${escapeHtml(cartao.id)}" aria-label="Excluir cartão">×</button>
                    <h3>${escapeHtml(cartao.nome)}</h3>
                    <p>Meta: ${cartao.metaPontos} pontos</p>
                    <p>Ganha ${pontos} ponto(s) por unidade · ${escapeHtml(regra)}</p>
                    <p>Recompensa: ${escapeHtml(cartao.recompensa)}</p>
                    <p>Desconto: R$ ${desconto}</p>
                    ${validade}
                </div>
            `;
        }).join("");

        cartoesListaEl.querySelectorAll("button.excluir-cartao").forEach(btn => {
            btn.addEventListener("click", evt => {
                evt.stopPropagation();
                evt.preventDefault();
                const id = btn.getAttribute("data-cartao-id");
                if (id) excluirCartaoFidelidade(id);
            });
        });
    } catch (erro) {
        console.error("Erro ao carregar cartões fidelidade:", erro);
        cartoesListaEl.innerHTML = '<p class="campaign-empty">Não foi possível carregar os cartões.</p>';
    }
}

criarCartaoBtn?.addEventListener("click", async () => {
    const nomeCartao = elsCriar.nomeCartao?.value.trim() || "";
    const metaPontos = Number(elsCriar.metaPontos?.value || 0);
    const recompensa = elsCriar.recompensa?.value.trim() || "";
    const descontoValor = Number(elsCriar.descontoValor?.value || 0);
    const validade = elsCriar.validade?.value || "";
    const scope = escopoFidelidade?.value || "all";
    const category = categoriaFidelidade?.value || "";
    const productIds = [...(produtosFidelidade?.querySelectorAll('input[type="checkbox"]:checked') || [])].map(input => String(input.value));
    const pointsPerItem = Math.max(1, Math.floor(Number(pontosPorItem?.value || 1)));

    const sessao = JSON.parse(localStorage.getItem("modaCenterSession") || "null");
    const ownerId = sessao?.id;

    if (!nomeCartao || !Number.isInteger(metaPontos) || metaPontos <= 0 || !recompensa || !(descontoValor > 0) || !ownerId) {
        if (mensagemCartao) mensagemCartao.textContent = "Preencha todos os campos obrigatórios!";
        return;
    }
    if (scope === "category" && !category) {
        if (mensagemCartao) mensagemCartao.textContent = "Selecione uma categoria.";
        return;
    }
    if (scope === "product" && !productIds.length) {
        if (mensagemCartao) mensagemCartao.textContent = "Selecione pelo menos um produto.";
        return;
    }

    criarCartaoBtn.disabled = true;
    try {
        const resposta = await fetch("/api/loyalty-cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId, nome: nomeCartao, metaPontos, recompensa, descontoValor, validade: validade || null, scope, category, productIds, pointsPerItem })
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) {
            if (mensagemCartao) mensagemCartao.textContent = dados.error || "Erro ao criar cartão fidelidade.";
            return;
        }
        if (mensagemCartao) mensagemCartao.textContent = "Cartão Fidelidade criado com sucesso!";
        elsCriar.nomeCartao && (elsCriar.nomeCartao.value = "");
        elsCriar.metaPontos && (elsCriar.metaPontos.value = "");
        elsCriar.recompensa && (elsCriar.recompensa.value = "");
        elsCriar.descontoValor && (elsCriar.descontoValor.value = "");
        elsCriar.validade && (elsCriar.validade.value = "");
        if (pontosPorItem) pontosPorItem.value = "1";
        if (escopoFidelidade) escopoFidelidade.value = "all";
        atualizarAlvosFidelidade();
        produtosFidelidade?.querySelectorAll('input[type="checkbox"]').forEach(input => input.checked = false);
        if (cartoesListPopup && !cartoesListPopup.hidden) await carregarCartoesFidelidade();
    } catch (erro) {
        console.error("Erro ao criar cartão fidelidade:", erro);
        if (mensagemCartao) mensagemCartao.textContent = "Não foi possível criar o cartão fidelidade.";
    } finally {
        criarCartaoBtn.disabled = false;
    }
});

(() => {
    const campoData = document.getElementById("validade");
    if (!campoData) return;
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    campoData.setAttribute("min", `${ano}-${mes}-${dia}`);
})();


// =========================================================
// CARDS DE FERRAMENTAS
// =========================================================
// =========================================================
// CARD "MODA CENTER LIVE E VÍDEO"
// =========================================================
// Este card usa a tela completa que já existe em:
// Comerciante/pages/modacenterliveandvideo.html
// Não recriamos a tela aqui e não mostramos "em desenvolvimento".
document.getElementById("modacenterLiveVideoCard")?.addEventListener("click", () => {
	const card = document.getElementById("modacenterLiveVideoCard");

	card?.animate([
		{ transform: "scale(1)" },
		{ transform: "scale(.97)" },
		{ transform: "scale(1)" }
	], { duration: 180 });

	window.location.href = "modacenterliveandvideo.html";
});

// =========================================================
// DEMAIS CARDS DE FERRAMENTAS
// =========================================================
document.querySelectorAll(".marketing-card").forEach(card => {
	card.addEventListener("click", () => {
		// O card Live e Vídeo possui navegação própria acima.
		if (card.id === "modacenterLiveVideoCard") return;
		if (card.id === "promotionsCard" || card.id === "flashOffersCard" || card.id === "cuponsCard" || card.id === "highlightsCard" || card.id === "bulkOffersCard" || card.id === "fidelidadeCard") return;

		card.animate([
			{ transform: "scale(1)" },
			{ transform: "scale(.97)" },
			{ transform: "scale(1)" }
		], { duration: 180 });

		const title = card.querySelector("strong")?.textContent || "Esta ferramenta";
		showToast(`${title}: recurso em desenvolvimento.`);
	});
});

// =========================================================
// BANNER "DICAS PARA VENDER MAIS"
// =========================================================
document.querySelector(".banner-button")?.addEventListener("click", () => {
	showToast("Conteúdo de dicas em desenvolvimento.");
});

// =========================================================
// MENU INFERIOR
// =========================================================
// Mesmo comportamento usado em chat.js: cada botão tem um
// data-page com o destino (arquivo + query string opcional).
document.querySelectorAll(".bottom-navigation .nav-item").forEach(button => {
	button.addEventListener("click", () => {
		const page = button.dataset.page;
		if (page) window.location.href = page;
	});
});

