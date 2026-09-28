const SESSION_KEY = "modaCenterSession";
const STORES_KEY = "modaCenterStores";
const PRODUCTS_KEY = "modaCenterProducts";
const ORDERS_KEY = "modaCenterOrders";

const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
const storesList = document.getElementById("storesList");
const storesCount = document.getElementById("storesCount");
const productsCount = document.getElementById("productsCount");
const ordersCount = document.getElementById("ordersCount");

if (!session || session.profile !== "administrador") {
  window.location.href = "../../index.html?login=1";
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function renderStores() {
  const stores = readJson(STORES_KEY, {});
  const products = readJson(PRODUCTS_KEY, {});
  const orders = readJson(ORDERS_KEY, []);
  const entries = Object.entries(stores);

  storesCount.textContent = String(entries.length);
  productsCount.textContent = String(Object.values(products).reduce((total, item) => total + (Array.isArray(item) ? item.length : 0), 0));
  ordersCount.textContent = String(Array.isArray(orders) ? orders.length : 0);

  if (!entries.length) {
    storesList.innerHTML = '<div class="empty-state">Nenhuma loja cadastrada no momento.</div>';
    return;
  }

  storesList.innerHTML = entries.map(([ownerId, store]) => {
    const items = Array.isArray(products[ownerId]) ? products[ownerId] : [];
    const tags = Array.isArray(store.segments) && store.segments.length ? store.segments : ["Loja"];
    return `
      <article class="store-card">
        <img src="${store.image || '../../assets/images/logo.png'}" alt="${store.name || 'Loja'}" onerror="this.onerror=null;this.src='../../assets/images/logo.png'" />
        <div>
          <h3>${store.name || "Loja sem nome"}</h3>
          <p>Proprietário: ${ownerId}</p>
          <p>Produtos: ${items.length}</p>
          <div class="tags">
            ${tags.map(tag => `<span class="tag">${tag}</span>`).join("")}
          </div>
        </div>
        <div class="store-actions">
          <button class="btn success" type="button" data-action="view" data-owner="${ownerId}">Ver</button>
          <button class="btn danger" type="button" data-action="delete" data-owner="${ownerId}">Apagar</button>
        </div>
      </article>
    `;
  }).join("");

  storesList.querySelectorAll("[data-action='view']").forEach(button => {
    button.addEventListener("click", () => {
      const ownerId = button.dataset.owner;
      const storesData = readJson(STORES_KEY, {});
      const store = storesData[ownerId];
      if (!store) return;
      alert(`${store.name}\n\nSegmentos: ${(store.segments || []).join(', ') || 'Sem segmento'}`);
    });
  });

  storesList.querySelectorAll("[data-action='delete']").forEach(button => {
    button.addEventListener("click", async () => {
      const ownerId = button.dataset.owner;
      const confirmed = window.confirm(`Deseja apagar a loja selecionada?\nIsso também removerá os produtos vinculados.`);
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/stores/${encodeURIComponent(ownerId)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
          throw new Error("Falha ao remover loja");
        }

        const allStores = readJson(STORES_KEY, {});
        delete allStores[ownerId];
        localStorage.setItem(STORES_KEY, JSON.stringify(allStores));

        const allProducts = readJson(PRODUCTS_KEY, {});
        delete allProducts[ownerId];
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(allProducts));

        window.location.reload();
      } catch (error) {
        alert("Não foi possível apagar a loja no momento.");
      }
    });
  });
}

document.getElementById("refreshStores").addEventListener("click", renderStores);
document.getElementById("adminLogout").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = "../../index.html?login=1";
});

renderStores();
