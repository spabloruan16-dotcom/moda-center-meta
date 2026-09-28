// =========================================================
// CONFIGURAÇÃO DA LOJA (cadastro-loja.html)
// =========================================================
// Formulário de primeiro acesso do comerciante: nome da loja e
// segmento(s) de roupa. É exibido só uma vez — depois de salvo,
// os dados ficam em "modaCenterStores" (ver JAVASCRIPT-GLOBAL/main.js) e o
// login passa a ir direto para inicio_comerciante.html.
//
// A validação de login/comerciante já foi feita por
// Comerciante/js/comerciante-guard.js (carregado antes deste arquivo).
// =========================================================

const STORES_KEY = "modaCenterStores";

// Se este comerciante já configurou a loja antes (ex.: ele voltou
// nesta página digitando a URL de novo), não faz sentido pedir
// os dados de novo — manda direto para a tela inicial.
let existingStores = {};
try {
    existingStores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
} catch (error) {
    existingStores = {};
}

if (!window.comercianteSession?.id) {
    window.location.href = "../../index.html?login=1&area=comerciante";
    throw new Error("Sessão de comerciante não encontrada."); 
}

if (existingStores[window.comercianteSession.id]?.location?.sector && existingStores[window.comercianteSession.id]?.location?.street && existingStores[window.comercianteSession.id]?.location?.box) {
	window.location.href = "inicio_comerciante.html";
}

if (window.location.protocol !== "file:") {
	fetch(`/api/stores/${encodeURIComponent(window.comercianteSession.id)}`, { cache: "no-store" }).then(response => response.json()).then(data => {
		if (!data.store?.location?.sector || !data.store.location.street || !data.store.location.box) return;
		let stores = {};
    try {
        stores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");
    } catch (error) {
        stores = {};
    }
		stores[window.comercianteSession.id] = data.store;
		localStorage.setItem(STORES_KEY, JSON.stringify(stores));
		window.location.href = "inicio_comerciante.html";
	}).catch(() => {});
}

// =========================================================
// ENVIO DO FORMULÁRIO
// =========================================================

const storeForm = document.getElementById("storeForm");
const storeNote = document.getElementById("storeNote");
const storeImageInput = document.getElementById("storeImage");
const submitButton = storeForm.querySelector('button[type="submit"]');

storeForm.addEventListener("submit", event => {
	event.preventDefault();

	const data = new FormData(storeForm);
	const storeName = String(data.get("storeName") || "").trim();
	const segments = String(data.get("segment") || "").split(",").map(segment => segment.trim()).filter(Boolean);
	const location = { sector: String(data.get("locationSector") || "").trim(), street: String(data.get("locationStreet") || "").trim(), box: String(data.get("locationBox") || "").trim() };

	// Validação simples: nome preenchido e pelo menos um segmento marcado.
	if (!storeName) {
		storeNote.textContent = "Informe o nome da sua loja.";
		return;
	}

	if (segments.length === 0) {
		storeNote.textContent = "Selecione pelo menos um segmento.";
		return;
	}

	if (!location.sector || !location.street || !location.box) {
		storeNote.textContent = "Informe o setor, a rua e o box da loja no Moda Center.";
		return;
	}

	// Salva a loja deste comerciante (indexada pelo id da sessão).
	const stores = JSON.parse(localStorage.getItem(STORES_KEY) || "{}");

	const saveStore = async image => {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "SALVANDO...";
        }

        const store = {
			name: storeName,
			segments: segments,
			image: image || null,
			location,
			createdAt: Date.now()
		};
		stores[window.comercianteSession.id] = {
			...store
		};

		localStorage.setItem(STORES_KEY, JSON.stringify(stores));
		if (window.location.protocol !== "file:") {
			try {
				const response = await fetch(`/api/stores/${encodeURIComponent(window.comercianteSession.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...store, ownerId: window.comercianteSession.id }) });
				if (!response.ok) throw new Error("Loja nao salva");
			} catch (error) {
				storeNote.textContent = "Não foi possível salvar a loja no servidor.";
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "SALVAR E CONTINUAR";
                }
                return;
			}
		}
		window.location.href = "inicio_comerciante.html";
	};

	const file = storeImageInput?.files[0];
	if (!file) {
		saveStore(null);
		return;
	}

	const reader = new FileReader();
	reader.onload = () => saveStore(reader.result);
	reader.readAsDataURL(file);
});
