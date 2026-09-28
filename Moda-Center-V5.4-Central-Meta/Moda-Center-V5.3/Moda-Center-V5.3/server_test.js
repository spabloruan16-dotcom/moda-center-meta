const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { mysqlEnabled } = require("./database");
const { registerUser, loginUser, syncUsers } = require("./auth-database");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_ROOTS = [path.join(__dirname, "v3"), path.join(__dirname, "Moda-Center-main", "v3"), __dirname];
const ROOT = PUBLIC_ROOTS.find(directory => fs.existsSync(path.join(directory, "index.html"))) || __dirname;
const DATA_FILE = path.join(__dirname, "server", "data.json");
const MAX_BODY_SIZE = 60 * 1024 * 1024;
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime" };

function readDatabase() {
    try {
    const database = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const products = (Array.isArray(database.products) ? database.products : []).filter(product => {
        // Remove o produto de demonstração legado das versões anteriores.
        return !(String(product?.id || "") === "p1" && String(product?.ownerId || "") === "test-merchant");
    });
    return { products, stores: database.stores || {}, orders: Array.isArray(database.orders) ? database.orders : [], chats: Array.isArray(database.chats) ? database.chats : [], presence: database.presence || {}, users: Array.isArray(database.users) ? database.users : [], coupons: Array.isArray(database.coupons) ? database.coupons : [], loyaltyCards: Array.isArray(database.loyaltyCards) ? database.loyaltyCards : [], loyaltyPoints: Array.isArray(database.loyaltyPoints) ? database.loyaltyPoints : [], loyaltyRedemptions: Array.isArray(database.loyaltyRedemptions) ? database.loyaltyRedemptions : [], videos: Array.isArray(database.videos) ? database.videos : []};
    } catch (error) {
    }
    return { products: [], stores: {}, orders: [], chats: [], presence: {}, users: [], coupons: [], loyaltyCards: [], loyaltyPoints: [], loyaltyRedemptions: [], videos: []};
}

function writeDatabase(database) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const temporaryFile = `${DATA_FILE}.${process.pid}.tmp`;
    const content = JSON.stringify(database, null, 2);
    fs.writeFileSync(temporaryFile, content);
    try {
        fs.renameSync(temporaryFile, DATA_FILE);
    } catch (error) {
        try {
            fs.writeFileSync(DATA_FILE, content);
        } finally {
            fs.rmSync(temporaryFile, { force: true });
        }
    }
}
//// Cartao de fidelidade
function adicionarPontoFidelidade(database, order) {
    if (!order || order.status !== "entregue") return;
    const clientId = String(order.clientId || "");
    if (!clientId) return;

    database.loyaltyCards = Array.isArray(database.loyaltyCards) ? database.loyaltyCards : [];
    database.loyaltyPoints = Array.isArray(database.loyaltyPoints) ? database.loyaltyPoints : [];

    const items = Array.isArray(order.items) ? order.items : [];
    const merchantIds = [...new Set(items.map(item => String(item.ownerId || "")).filter(Boolean))];

    for (const merchantId of merchantIds) {
        const cards = database.loyaltyCards.filter(card => String(card.ownerId || "") === merchantId);
        for (const card of cards) {
            let record = database.loyaltyPoints.find(item =>
                String(item.cartaoId) === String(card.id) && String(item.clientId) === clientId
            );
            if (!record) {
                record = { cartaoId: card.id, clientId, pontos: 0, pedidos: [] };
                database.loyaltyPoints.push(record);
            }
            record.pedidos = Array.isArray(record.pedidos) ? record.pedidos : [];
            if (record.pedidos.some(orderId => String(orderId) === String(order.id))) continue;

            const scope = card.scope === "category" || card.scope === "product" ? card.scope : "all";
            const selectedProductIds = Array.isArray(card.productIds) ? card.productIds.map(String) : [];
            const eligibleItems = items.filter(item => {
                if (String(item.ownerId) !== merchantId) return false;
                if (scope === "category") return String(item.category || "") === String(card.category || "");
                if (scope === "product") return selectedProductIds.includes(String(item.productId));
                return true;
            });

            const pointsPerItem = Math.max(1, Math.floor(Number(card.pointsPerItem || 1)));
            const earned = eligibleItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)) * pointsPerItem, 0);
            record.pontos = Math.max(0, Number(record.pontos || 0)) + earned;
            record.pedidos.push(order.id);

            const meta = Number(card.metaPontos || 0);
            if (Number.isFinite(meta) && meta > 0) record.pontos = Math.min(record.pontos, meta);
        }
    }
}

function sendJson(response, status, payload) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify(payload));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", chunk => {
            body += chunk;
            if (Buffer.byteLength(body) > MAX_BODY_SIZE) reject(new Error("Payload muito grande"));
        });
        request.on("end", () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (error) { reject(new Error("JSON invalido")); }
        });
        request.on("error", reject);
    });
}

function normalizeProduct(input) {
    const name = String(input.name || "").trim();
    const price = Number(input.price);
    if (!name || !Number.isFinite(price) || price <= 0) return null;
    const wholesale = input.wholesale && Number(input.wholesale.minQuantity) >= 2 && Number(input.wholesale.price) > 0 ? { minQuantity: Number(input.wholesale.minQuantity), price: Number(input.wholesale.price) } : null;
    const variations = Array.isArray(input.variations) ? input.variations.map(variation => ({ id: String(variation.id || crypto.randomUUID()), color: String(variation.color || "").trim(), size: String(variation.size || "").trim(), quantity: Math.max(0, Number(variation.quantity || 0)) })).filter(variation => variation.color && variation.size) : [];
    const quantity = variations.length ? variations.reduce((total, variation) => total + variation.quantity, 0) : Math.max(0, Number(input.quantity || 0));
   // ----------(incio) modificado por Marcos Persistência e normalização do estado de destaque do produto---------
    return { id: String(input.id || crypto.randomUUID()), clientRequestId: input.clientRequestId ? String(input.clientRequestId) : null, ownerId: String(input.ownerId), ownerName: String(input.ownerName || "Loja Moda Center"), name, description: String(input.description || ""), price, category: String(input.category || "Produto"), segments: Array.isArray(input.segments) ? input.segments : [], image: input.image || null, quantity, variations, discount: Math.min(100, Math.max(0, Number(input.discount || 0))), wholesale, salesCount: Math.max(0, Number(input.salesCount || 0)), ratings: Array.isArray(input.ratings) ? input.ratings : [], highlighted: Boolean(input.highlighted), published: input.published !== false, campaignId: input.campaignId || null, flashOffer: input.flashOffer || null, createdAt: input.createdAt || Date.now() };
// ----------(final) modificado por Marcos Persistência e normalização do estado de destaque do produto---------}
}



// =========================================================
// LIVE REAL-TIME + VÍDEOS PUBLICADOS
// =========================================================
// A LIVE usa WebRTC: o servidor faz apenas a sinalização (offer/answer/ICE).
// O áudio e vídeo vão diretamente do navegador do comerciante para o navegador
// do cliente. Isso deixa a transmissão realmente ao vivo sem precisar subir
// o vídeo da câmera para o servidor.
const activeLives = new Map();
const liveSignals = new Map();
const LIVE_SIGNAL_TTL = 2 * 60 * 1000;
const VIDEO_DIR = path.join(ROOT, "uploads", "videos");
fs.mkdirSync(VIDEO_DIR, { recursive: true });

function cleanLiveSignals(liveId) {
    const now = Date.now();
    const list = liveSignals.get(liveId) || [];
    const filtered = list.filter(item => now - item.createdAt < LIVE_SIGNAL_TTL);
    liveSignals.set(liveId, filtered);
    return filtered;
}

function publicLive(live) {
    if (!live) return null;
    return {
        id: live.id,
        ownerId: live.ownerId,
        ownerName: live.ownerName,
        title: live.title,
        description: live.description,
        cover: live.cover || null,
        createdAt: live.createdAt,
        viewers: live.viewers.size
    };
}

function readRawBody(request, maxBytes = MAX_BODY_SIZE) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let settled = false;
        request.on("data", chunk => {
            if (settled) return;
            total += chunk.length;
            if (total > maxBytes) {
                settled = true;
                reject(new Error("Arquivo muito grande. Limite de 60 MB."));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on("end", () => {
            if (!settled) resolve(Buffer.concat(chunks));
        });
        request.on("error", error => { if (!settled) reject(error); });
    });
}

function sanitizeFileName(value) {
    return String(value || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "video.mp4";
}

async function handleApi(request, response, url) {
    const database = readDatabase();
    if (request.method === "GET" && url.pathname === "/api/health") return sendJson(response, 200, { ok: true, timestamp: new Date().toISOString() });
    if (request.method === "GET" && url.pathname === "/api/catalog") return sendJson(response, 200, { products: database.products, stores: database.stores, coupons: database.coupons, loyaltyCards: database.loyaltyCards });


    // -------------------------
    // VÍDEOS PUBLICADOS
    // -------------------------
    if (request.method === "GET" && url.pathname === "/api/videos") {
        const ownerId = String(url.searchParams.get("ownerId") || "");
        const videos = database.videos.filter(video => video.active !== false && (!ownerId || String(video.ownerId) === ownerId));
        return sendJson(response, 200, { videos: videos.sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) });
    }

    if (request.method === "POST" && url.pathname === "/api/videos/upload") {
        const ownerId = String(url.searchParams.get("ownerId") || "");
        const title = String(url.searchParams.get("title") || "").trim();
        const description = String(url.searchParams.get("description") || "").trim();
        const ownerName = String(url.searchParams.get("ownerName") || "Loja Moda Center").trim();
        const originalName = sanitizeFileName(url.searchParams.get("fileName") || "video.mp4");
        const contentType = String(request.headers["content-type"] || "video/mp4").split(";")[0].toLowerCase();
        if (!ownerId || !title) return sendJson(response, 400, { error: "Comerciante e título são obrigatórios" });
        if (!/^video\/(mp4|webm|quicktime|x-matroska)$/.test(contentType)) return sendJson(response, 415, { error: "Formato de vídeo não suportado" });
        const data = await readRawBody(request, 60 * 1024 * 1024);
        if (!data.length) return sendJson(response, 400, { error: "O arquivo de vídeo está vazio" });
        const extByType = { "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov", "video/x-matroska": ".mkv" };
        const ext = extByType[contentType] || path.extname(originalName) || ".mp4";
        const id = crypto.randomUUID();
        const fileName = `${id}${ext}`;
        fs.writeFileSync(path.join(VIDEO_DIR, fileName), data);
        const video = { id, ownerId, ownerName, title, description, url: `/uploads/videos/${fileName}`, originalName, contentType, size: data.length, createdAt: Date.now(), active: true };
        database.videos.push(video);
        writeDatabase(database);
        return sendJson(response, 201, { video });
    }

    const videoDeleteMatch = url.pathname.match(/^\/api\/videos\/([^/]+)$/);
    if (request.method === "DELETE" && videoDeleteMatch) {
        const id = decodeURIComponent(videoDeleteMatch[1]);
        const input = await readBody(request);
        const index = database.videos.findIndex(video => String(video.id) === id && String(video.ownerId) === String(input.ownerId || ""));
        if (index < 0) return sendJson(response, 404, { error: "Vídeo não encontrado" });
        const video = database.videos[index];
        database.videos.splice(index, 1);
        if (video.url) fs.rmSync(path.join(ROOT, video.url.replace(/^\//, "")), { force: true });
        writeDatabase(database);
        return sendJson(response, 200, { ok: true });
    }

    // -------------------------
    // LIVES WEBRTC
    // -------------------------
    if (request.method === "GET" && url.pathname === "/api/live") {
        for (const [id, live] of activeLives) {
            if (Date.now() - live.createdAt > 24 * 60 * 60 * 1000) activeLives.delete(id);
        }
        return sendJson(response, 200, { lives: [...activeLives.values()].map(publicLive) });
    }

    if (request.method === "POST" && url.pathname === "/api/live") {
        const input = await readBody(request);
        const ownerId = String(input.ownerId || "");
        const title = String(input.title || "").trim();
        if (!ownerId || !title) return sendJson(response, 400, { error: "Comerciante e título são obrigatórios" });
        const id = crypto.randomUUID();
        const broadcasterPeerId = `broadcaster_${crypto.randomUUID()}`;
        const live = { id, ownerId, ownerName: String(input.ownerName || "Loja Moda Center"), title, description: String(input.description || ""), cover: input.cover || null, createdAt: Date.now(), broadcasterPeerId, viewers: new Map() };
        activeLives.set(id, live);
        liveSignals.set(id, []);
        return sendJson(response, 201, { live: publicLive(live), broadcasterPeerId });
    }

    const liveJoinMatch = url.pathname.match(/^\/api\/live\/([^/]+)\/join$/);
    if (request.method === "POST" && liveJoinMatch) {
        const id = decodeURIComponent(liveJoinMatch[1]);
        const live = activeLives.get(id);
        if (!live) return sendJson(response, 404, { error: "Essa live não está mais disponível" });
        const peerId = `viewer_${crypto.randomUUID()}`;
        live.viewers.set(peerId, { joinedAt: Date.now() });
        return sendJson(response, 200, { peerId, broadcasterPeerId: live.broadcasterPeerId, live: publicLive(live) });
    }

    const liveSignalMatch = url.pathname.match(/^\/api\/live\/([^/]+)\/signal$/);
    if (request.method === "POST" && liveSignalMatch) {
        const id = decodeURIComponent(liveSignalMatch[1]);
        const live = activeLives.get(id);
        if (!live) return sendJson(response, 404, { error: "Live encerrada" });
        const input = await readBody(request);
        const from = String(input.from || "");
        const to = String(input.to || "");
        if (!from || !to || !input.type) return sendJson(response, 400, { error: "Sinal WebRTC inválido" });
        const validPeer = from === live.broadcasterPeerId || live.viewers.has(from);
        if (!validPeer) return sendJson(response, 403, { error: "Participante inválido" });
        cleanLiveSignals(id).push({ id: crypto.randomUUID(), from, to, type: String(input.type), data: input.data || null, createdAt: Date.now() });
        return sendJson(response, 200, { ok: true });
    }

    const liveSignalsMatch = url.pathname.match(/^\/api\/live\/([^/]+)\/signals$/);
    if (request.method === "GET" && liveSignalsMatch) {
        const id = decodeURIComponent(liveSignalsMatch[1]);
        const live = activeLives.get(id);
        if (!live) return sendJson(response, 404, { error: "Live encerrada" });
        const peerId = String(url.searchParams.get("peerId") || "");
        if (!peerId || (peerId !== live.broadcasterPeerId && !live.viewers.has(peerId))) return sendJson(response, 403, { error: "Participante inválido" });
        const signals = cleanLiveSignals(id);
        const mine = signals.filter(signal => signal.to === peerId);
        const remaining = signals.filter(signal => signal.to !== peerId);
        liveSignals.set(id, remaining);
        return sendJson(response, 200, { signals: mine, viewers: [...live.viewers.keys()] });
    }

    const liveLeaveMatch = url.pathname.match(/^\/api\/live\/([^/]+)\/leave$/);
    if (request.method === "POST" && liveLeaveMatch) {
        const id = decodeURIComponent(liveLeaveMatch[1]);
        const live = activeLives.get(id);
        if (!live) return sendJson(response, 200, { ok: true });
        const input = await readBody(request);
        const peerId = String(input.peerId || "");
        if (peerId === live.broadcasterPeerId) {
            activeLives.delete(id); liveSignals.delete(id);
        } else {
            live.viewers.delete(peerId);
        }
        return sendJson(response, 200, { ok: true });
    }

    if (request.method === "GET" && url.pathname === "/api/coupons") {
        const ownerId = String(url.searchParams.get("ownerId") || "");
        const coupons = database.coupons.filter(coupon => !ownerId || String(coupon.ownerId) === ownerId);
        return sendJson(response, 200, { coupons });
    }

    if (request.method === "POST" && url.pathname === "/api/coupons") {
        const input = await readBody(request);
        const ownerId = String(input.ownerId || "");
        const code = String(input.code || "").trim();
        if (!ownerId || !code) return sendJson(response, 400, { error: "ownerId e código do cupom são obrigatórios" });
        database.coupons = Array.isArray(database.coupons) ? database.coupons : [];
        const duplicate = database.coupons.find(c => String(c.ownerId) === ownerId && String(c.code || "").toLowerCase() === code.toLowerCase() && String(c.id) !== String(input.id || ""));
        if (duplicate) return sendJson(response, 409, { error: "Esse código de cupom já está sendo usado" });
        const coupon = {
            id: String(input.id || crypto.randomUUID()), type: "coupon", name: String(input.name || "Cupom"), code,
            discount: Math.min(100, Math.max(0, Number(input.discount || 0))), scope: input.scope === "category" || input.scope === "product" ? input.scope : "all",
            category: String(input.category || ""), productId: input.productId ? String(input.productId) : "", productName: String(input.productName || ""),
            start: input.start || "", end: input.end || "", limit: input.limit == null || input.limit === "" ? null : Math.max(1, Number(input.limit)),
            used: Math.max(0, Number(input.used || 0)), active: input.active !== false, ownerId
        };
        database.coupons = database.coupons.filter(c => !(String(c.id) === coupon.id && String(c.ownerId) === ownerId));
        database.coupons.push(coupon); writeDatabase(database);
        return sendJson(response, 201, { coupon });
    }

    if (request.method === "POST" && url.pathname === "/api/coupons/validate") {
        const input = await readBody(request);
        const code = String(input.code || "").trim();
        const requestedItems = Array.isArray(input.items) ? input.items : [];
        if (!code || !requestedItems.length) return sendJson(response, 400, { error: "Código do cupom e produtos são obrigatórios" });
        const coupon = database.coupons.find(c => String(c.code || "").trim().toLowerCase() === code.toLowerCase() && c.active !== false);
        if (!coupon) return sendJson(response, 404, { error: "Cupom inválido ou não disponível" });
        const now = new Date();
        if (coupon.start && new Date(coupon.start) > now) return sendJson(response, 400, { error: `Cupom ${code} ainda não está válido` });
        if (coupon.end && new Date(coupon.end) < now) return sendJson(response, 400, { error: `Cupom ${code} expirado` });
        if (coupon.limit && Number(coupon.used || 0) >= Number(coupon.limit)) return sendJson(response, 400, { error: `Cupom ${code} atingiu o limite de usos` });

        let eligibleSubtotal = 0;
        for (const requested of requestedItems) {
            const product = database.products.find(item => String(item.id) === String(requested.productId));
            if (!product || String(product.ownerId) !== String(coupon.ownerId)) continue;
            const eligible = coupon.scope === "all"
                || (coupon.scope === "category" && String(product.category || "") === String(coupon.category || ""))
                || (coupon.scope === "product" && String(product.id) === String(coupon.productId));
            if (eligible) eligibleSubtotal += Number(product.price || 0) * Math.max(1, Number(requested.quantity || 1));
        }
        if (eligibleSubtotal <= 0) return sendJson(response, 400, { error: `Cupom ${code} não se aplica aos produtos do carrinho` });
        const discount = eligibleSubtotal * Math.min(100, Math.max(0, Number(coupon.discount || 0))) / 100;
        return sendJson(response, 200, { coupon, eligibleSubtotal, discount });
    }

    const couponDeleteMatch = url.pathname.match(/^\/api\/coupons\/([^/]+)$/);
    if (request.method === "DELETE" && couponDeleteMatch) {
        const input = await readBody(request); const id = decodeURIComponent(couponDeleteMatch[1]);
        const before = database.coupons.length;
        database.coupons = database.coupons.filter(c => !(String(c.id) === id && String(c.ownerId) === String(input.ownerId || "")));
        if (database.coupons.length === before) return sendJson(response, 404, { error: "Cupom não encontrado" });
        writeDatabase(database); return sendJson(response, 200, { ok: true });
    }

    // A V5.2 usa MySQL somente para autenticacao e preserva o banco JSON
    // existente para catalogo, lojas, pedidos, chats e presenca.
    const authPath = url.pathname === "/api/auth/register" || url.pathname === "/api/register";
    const loginPath = url.pathname === "/api/auth/login" || url.pathname === "/api/login";
    if ((mysqlEnabled && request.method === "POST" && authPath) || (request.method === "POST" && url.pathname === "/api/register")) {
        const result = await registerUser(await readBody(request), database);
        if (result.changed) writeDatabase(database);
        return sendJson(response, result.status, result.error ? { error: result.error, mensagem: result.error } : { user: result.user, usuario: result.user });
    }
    if ((mysqlEnabled && request.method === "POST" && loginPath) || (request.method === "POST" && url.pathname === "/api/login")) {
        const result = await loginUser(await readBody(request), database);
        if (result.changed) writeDatabase(database);
        return sendJson(response, result.status, result.error ? { error: result.error, mensagem: result.error } : { user: result.user, usuario: result.user });
    }
    if (mysqlEnabled && request.method === "POST" && url.pathname === "/api/auth/sync") {
        await syncUsers((await readBody(request)).users, database);
        return sendJson(response, 200, { ok: true });
    }

    const storeMatch = url.pathname.match(/^\/api\/stores\/([^/]+)$/);
    if (request.method === "GET" && storeMatch) return sendJson(response, 200, { store: database.stores[decodeURIComponent(storeMatch[1])] || null });
    if (request.method === "PUT" && storeMatch) {
        const ownerId = decodeURIComponent(storeMatch[1]);
        const input = await readBody(request);
        const segments = Array.isArray(input.segments) ? input.segments.map(item => String(item).trim()).filter(Boolean) : String(input.segments || "").split(",").map(item => item.trim()).filter(Boolean);
        if (String(input.ownerId) !== ownerId || !String(input.name || "").trim() || !segments.length) return sendJson(response, 400, { error: "Dados da loja invalidos" });
        const location = input.location && typeof input.location === "object" ? { sector: String(input.location.sector || "").trim(), street: String(input.location.street || "").trim(), box: String(input.location.box || "").trim() } : null;
        if (!location?.sector || !location.street || !location.box) return sendJson(response, 400, { error: "Localizacao da loja invalida" });
        database.stores[ownerId] = { name: String(input.name).trim(), segments, image: input.image || null, location, createdAt: input.createdAt || Date.now() };
        writeDatabase(database);
        return sendJson(response, 200, { store: database.stores[ownerId] });
    }
// =========================================================
// CARTÃO DE FIDELIDADE
// =========================================================

// Listar cartões de fidelidade
if (request.method === "GET" && url.pathname === "/api/loyalty-cards") {
    return sendJson(response, 200, { cartoes: database.loyaltyCards });
}

// Criar cartão de fidelidade
if (request.method === "POST" && url.pathname === "/api/loyalty-cards") {
    const input = await readBody(request);
    const nome = String(input.nome || "").trim();
    const metaPontos = Number(input.metaPontos);
    const recompensa = String(input.recompensa || "").trim();
    const validade = input.validade ? String(input.validade) : null;
    const ownerId = String(input.ownerId || "").trim();
    const descontoValor = Number(input.descontoValor || 0);
    const scope = input.scope === "category" || input.scope === "product" ? input.scope : "all";
    const category = String(input.category || "").trim();
    const productIds = Array.isArray(input.productIds) ? [...new Set(input.productIds.map(String).filter(Boolean))] : [];
    const pointsPerItem = Math.max(1, Math.floor(Number(input.pointsPerItem || 1)));

    if (!nome || !Number.isInteger(metaPontos) || metaPontos <= 0 || !recompensa || !ownerId || !(descontoValor > 0)) {
        return sendJson(response, 400, { error: "Dados do cartão fidelidade invalidos" });
    }
    if (scope === "category" && !category) return sendJson(response, 400, { error: "Selecione uma categoria para o cartão" });
    if (scope === "product" && !productIds.length) return sendJson(response, 400, { error: "Selecione pelo menos um produto para o cartão" });

    const availableProducts = database.products.filter(product => String(product.ownerId) === ownerId);
    if (scope === "category" && !availableProducts.some(product => String(product.category || "") === category)) {
        return sendJson(response, 400, { error: "A categoria selecionada não possui produtos cadastrados" });
    }
    if (scope === "product" && productIds.some(id => !availableProducts.some(product => String(product.id) === id))) {
        return sendJson(response, 400, { error: "Um dos produtos selecionados não pertence à sua loja" });
    }

    const cartao = {
        id: crypto.randomUUID(), ownerId, nome, metaPontos, recompensa, descontoValor, validade,
        scope, category: scope === "category" ? category : "", productIds: scope === "product" ? productIds : [],
        pointsPerItem, createdAt: Date.now()
    };
    database.loyaltyCards = Array.isArray(database.loyaltyCards) ? database.loyaltyCards : [];
    database.loyaltyCards.push(cartao);
    writeDatabase(database);
    return sendJson(response, 201, { cartao });
}

// Excluir cartão de fidelidade (e também pontos/resgates associados)
if (request.method === "DELETE" && url.pathname.startsWith("/api/loyalty-cards/")) {
    const cartaoId = String(url.pathname.split("/api/loyalty-cards/")[1] || "").trim();
    if (!cartaoId) {
        return sendJson(response, 400, { error: "ID do cartão é obrigatório" });
    }

    database.loyaltyCards = Array.isArray(database.loyaltyCards) ? database.loyaltyCards : [];
    const index = database.loyaltyCards.findIndex(c => String(c.id) === cartaoId);
    if (index === -1) {
        return sendJson(response, 404, { error: "Cartão não encontrado" });
    }

    database.loyaltyCards.splice(index, 1);
    database.loyaltyPoints = (database.loyaltyPoints || []).filter(p => String(p.cartaoId) !== cartaoId);
    database.loyaltyRedemptions = (database.loyaltyRedemptions || []).filter(r => String(r.cartaoId) !== cartaoId);
    writeDatabase(database);
    return sendJson(response, 200, { ok: true });
}

// =========================================================
// PONTOS DO CARTÃO DE FIDELIDADE
// =========================================================

if (request.method === "GET" && url.pathname === "/api/loyalty-points") {
    const cartaoId = String(url.searchParams.get("cartaoId") || "");
    const clientId = String(url.searchParams.get("clientId") || "");

    if (!cartaoId || !clientId) {
        return sendJson(response, 400, { error: "Cartão e cliente são obrigatórios" });
    }

    const cartao = database.loyaltyCards.find(item => String(item.id) === cartaoId);
    if (!cartao) {
        return sendJson(response, 404, { error: "Cartão não encontrado" });
    }

    const registro = database.loyaltyPoints.find(item =>
        String(item.cartaoId) === cartaoId && String(item.clientId) === clientId
    );

    return sendJson(response, 200, {
        pontos: registro ? Number(registro.pontos) || 0 : 0
    });
}

// =========================================================
// RECOMPENSAS ELEGÍVEIS + RESGATE
// =========================================================

if (request.method === "GET" && url.pathname === "/api/loyalty-eligible") {
    const clientId = String(url.searchParams.get("clientId") || "");
    if (!clientId) {
        return sendJson(response, 400, { error: "clientId obrigatório" });
    }

    const redemptions = Array.isArray(database.loyaltyRedemptions) ? database.loyaltyRedemptions : [];
    const usados = new Set(
        redemptions
            .filter(r => String(r.clientId) === clientId && !r.usedOrderId)
            .map(r => String(r.cartaoId))
    );

    const elegiveis = [];
    for (const cartao of database.loyaltyCards) {
        if (cartao.validade) {
            const validade = new Date(cartao.validade);
            if (validade < new Date()) continue;
        }

        const registro = database.loyaltyPoints.find(item =>
            String(item.cartaoId) === String(cartao.id) && String(item.clientId) === clientId
        );
        const pontos = registro ? Number(registro.pontos || 0) : 0;
        const meta = Number(cartao.metaPontos || 0);

        if (pontos >= meta && !usados.has(String(cartao.id))) {
            elegiveis.push({
                cartaoId: cartao.id,
                ownerId: cartao.ownerId || null,
                nome: cartao.nome,
                recompensa: cartao.recompensa,
                descontoValor: Number(cartao.descontoValor || 0),
                metaPontos: meta,
                pontosAtuais: pontos
            });
        }
    }

    return sendJson(response, 200, { elegiveis });
}

if (request.method === "POST" && url.pathname === "/api/loyalty-redeem") {
    const input = await readBody(request);
    const clientId = String(input.clientId || "");
    const cartaoId = String(input.cartaoId || "");

    if (!clientId || !cartaoId) {
        return sendJson(response, 400, { error: "clientId e cartaoId obrigatórios" });
    }

    const cartao = database.loyaltyCards.find(c => String(c.id) === cartaoId);
    if (!cartao) {
        return sendJson(response, 404, { error: "Cartão não encontrado" });
    }

    const registro = database.loyaltyPoints.find(item =>
        String(item.cartaoId) === cartaoId && String(item.clientId) === clientId
    );
    const pontos = registro ? Number(registro.pontos || 0) : 0;
    const meta = Number(cartao.metaPontos || 0);

    if (pontos < meta) {
        return sendJson(response, 400, { error: "Pontos insuficientes para resgatar" });
    }

    database.loyaltyRedemptions = Array.isArray(database.loyaltyRedemptions) ? database.loyaltyRedemptions : [];
    const jaResgatado = database.loyaltyRedemptions.some(r =>
        String(r.clientId) === clientId && String(r.cartaoId) === cartaoId && !r.usedOrderId
    );
    if (jaResgatado) {
        return sendJson(response, 409, { error: "Recompensa já resgatada, aguardando uso no pedido" });
    }

    const resgate = {
        id: crypto.randomUUID(),
        clientId,
        cartaoId,
        ownerId: cartao.ownerId || null,
        descontoValor: Number(cartao.descontoValor || 0),
        usedOrderId: null,
        createdAt: Date.now()
    };

    database.loyaltyRedemptions.push(resgate);
    writeDatabase(database);
    return sendJson(response, 201, { resgate });
}
    if (request.method === "DELETE" && storeMatch) {
        const ownerId = decodeURIComponent(storeMatch[1]);
        if (!database.stores[ownerId]) return sendJson(response, 404, { error: "Loja nao encontrada" });
        delete database.stores[ownerId];
        database.products = database.products.filter(product => String(product.ownerId) !== String(ownerId));
        database.orders = database.orders.filter(order => !order.items.some(item => String(item.ownerId) === String(ownerId)));
        writeDatabase(database);
        return sendJson(response, 200, { ok: true, removedOwnerId: ownerId });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/sync") {
        const input = await readBody(request);
        const users = Array.isArray(input.users) ? input.users : [];
        users.forEach(user => {
            if (!user.email || !user.password || database.users.some(item => item.email === String(user.email).toLowerCase())) return;
            const profile = user.profile === "comerciante" ? "comerciante" : user.profile === "administrador" ? "administrador" : "cliente";
            database.users.push({ id: String(user.id || crypto.randomUUID()), name: String(user.name || "Usuario").trim(), email: String(user.email).toLowerCase(), password: String(user.password), profile, avatar: user.avatar || null });
        });
        writeDatabase(database);
        return sendJson(response, 200, { ok: true });
    }

    if (request.method === "GET" && url.pathname === "/api/stores") {
        return sendJson(response, 200, { stores: database.stores });
    }

    if (request.method === "POST" && url.pathname === "/api/auth/register") {

    const input = await readBody(request);

    const name = String(input.name || "").trim();

    const email = String(input.email || "")
        .trim()
        .toLowerCase();

    const password = String(input.password || "");

    const registrationId = String(
        input.registrationId || ""
    ).trim();


    // ==========================================
    // VALIDAÇÃO
    // ==========================================

    if (
        name.length < 2 ||
        !email ||
        password.length < 1
    ) {
        return sendJson(
            response,
            400,
            {
                error: "Dados de cadastro invalidos"
            }
        );
    }


    // ==========================================
    // ID DA TENTATIVA DE CADASTRO
    // ==========================================

    const userId =
        registrationId ||
        crypto.randomUUID();


    // ==========================================
    // VERIFICA SE O E-MAIL JÁ EXISTE
    // ==========================================

    const existingUser =
        database.users.find(
            user => user.email === email
        );


    if (existingUser) {

        // ------------------------------------------
        // IMPORTANTE:
        // Se for a MESMA tentativa de cadastro,
        // significa que o servidor provavelmente
        // criou a conta mas a resposta não chegou
        // ao navegador.
        // ------------------------------------------

        if (
            String(existingUser.id) ===
            String(userId)
        ) {

            return sendJson(
                response,
                200,
                {
                    user: {
                        id: existingUser.id,
                        name: existingUser.name,
                        email: existingUser.email,
                        avatar: existingUser.avatar || null,
                        profile: existingUser.profile
                    }
                }
            );
        }


        // É outro cadastro tentando usar o mesmo e-mail.

        return sendJson(
            response,
            409,
            {
                error:
                    "Este e-mail ja esta cadastrado"
            }
        );
    }


    // ==========================================
    // VERIFICA NOME DUPLICADO
    // ==========================================

    const existingName =
        database.users.find(
            user =>
                String(user.name || "")
                    .trim()
                    .toLowerCase() ===
                name.toLowerCase()
        );


    if (existingName) {

        return sendJson(
            response,
            409,
            {
                error:
                    "Este nome de usuario ja esta em uso"
            }
        );
    }


    // ==========================================
    // CRIA NOVO USUÁRIO
    // ==========================================

    const user = {

        id: userId,

        name,

        email,

        password,

        profile:
            input.profile === "comerciante"
                ? "comerciante"
                : input.profile === "administrador"
                    ? "administrador"
                    : "cliente",

        avatar:
            input.avatar || null

    };


    database.users.push(user);


    // ==========================================
    // SALVA NO BANCO
    // ==========================================

    writeDatabase(database);


    // ==========================================
    // RESPONDE SEM SENHA
    // ==========================================

    return sendJson(
        response,
        201,
        {
            user: {

                id: user.id,

                name: user.name,

                email: user.email,

                avatar:
                    user.avatar || null,

                profile:
                    user.profile

            }
        }
    );
}

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
        const input = await readBody(request);
        const email = String(input.email || "").trim().toLowerCase();
        const normalizedEmail = email === "admin" ? "admin@modacenter.com" : email;
        const normalizedPassword = String(input.password || "");
        const existingAdmin = database.users.find(item => item.email === "admin@modacenter.com");
        if (!existingAdmin && normalizedEmail === "admin@modacenter.com" && normalizedPassword === "123456") {
            const adminUser = { id: "admin", name: "Administrador", email: "admin@modacenter.com", password: "123456", profile: "administrador", avatar: null };
            database.users.push(adminUser);
            writeDatabase(database);
            return sendJson(response, 200, { user: { id: adminUser.id, name: adminUser.name, email: adminUser.email, avatar: adminUser.avatar || null, profile: adminUser.profile } });
        }
        const user = database.users.find(item => item.email === normalizedEmail && item.password === normalizedPassword);
        if (!user) return sendJson(response, 401, { error: "E-mail ou senha invalidos" });
        return sendJson(response, 200, { user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar || null, profile: user.profile } });
    }

    if (request.method === "GET" && url.pathname === "/api/chats") {
        const userId = String(url.searchParams.get("userId") || "");
        if (!userId) return sendJson(response, 400, { error: "userId obrigatorio" });
        return sendJson(response, 200, { chats: database.chats.filter(chat => String(chat.clientId) === userId || String(chat.merchantId) === userId) });
    }

    if (request.method === "POST" && url.pathname === "/api/chats") {
        const input = await readBody(request);
        if (!input.id || !input.clientId || !input.merchantId) return sendJson(response, 400, { error: "Conversa invalida" });
        const existingIndex = database.chats.findIndex(chat => String(chat.id) === String(input.id));
        const chat = { ...input, messages: Array.isArray(input.messages) ? input.messages : [], unreadCounts: input.unreadCounts || {}, updatedAt: Number(input.updatedAt || Date.now()) };
        if (existingIndex >= 0) database.chats[existingIndex] = { ...database.chats[existingIndex], ...chat, messages: chat.messages.length ? chat.messages : database.chats[existingIndex].messages || [] };
        else database.chats.push(chat);
        writeDatabase(database);
        return sendJson(response, 201, { chat });
    }

    const chatActionMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/);
    if ((request.method === "PATCH" || request.method === "DELETE") && chatActionMatch) {
        const chatIndex = database.chats.findIndex(item => String(item.id) === decodeURIComponent(chatActionMatch[1]));
        if (chatIndex < 0) return sendJson(response, 404, { error: "Conversa nao encontrada" });
        const input = await readBody(request);
        const chat = database.chats[chatIndex];
        if (String(input.actorId) !== String(chat.clientId) && String(input.actorId) !== String(chat.merchantId)) return sendJson(response, 403, { error: "Usuario nao participa desta conversa" });
        if (request.method === "DELETE") database.chats.splice(chatIndex, 1);
        else {
            if (input.action === "pin") chat.pinned = Boolean(input.pinned);
            else if (input.action === "read") {
                chat.unreadCounts = chat.unreadCounts || {};
                chat.unreadCounts[String(input.actorId)] = 0;
                if (String(chat.unreadFor || "") === String(input.actorId)) chat.unreadFor = null;
            } else return sendJson(response, 400, { error: "Acao invalida" });
        }
        writeDatabase(database);
        return sendJson(response, 200, { ok: true });
    }

    const chatMessageMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
    if (request.method === "POST" && chatMessageMatch) {
        const input = await readBody(request);
        const chat = database.chats.find(item => String(item.id) === decodeURIComponent(chatMessageMatch[1]));
        if (!chat || !input.senderId || !String(input.text || "").trim()) return sendJson(response, 400, { error: "Mensagem invalida" });
        chat.messages = Array.isArray(chat.messages) ? chat.messages : [];
        chat.messages.push({ id: input.id || crypto.randomUUID(), senderId: String(input.senderId), text: String(input.text).trim(), time: input.time || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
        chat.updatedAt = Date.now();
        chat.unreadCounts = chat.unreadCounts || {};
        chat.unreadCounts[String(input.recipientId)] = Number(chat.unreadCounts[String(input.recipientId)] || 0) + 1;
        chat.unreadFor = String(input.recipientId);
        writeDatabase(database);
        return sendJson(response, 201, { chat });
    }

    const messageActionMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages\/([^/]+)$/);
    if ((request.method === "PATCH" || request.method === "DELETE") && messageActionMatch) {
        const chat = database.chats.find(item => String(item.id) === decodeURIComponent(messageActionMatch[1]));
        const message = chat?.messages?.find(item => String(item.id) === decodeURIComponent(messageActionMatch[2]));
        if (!chat || !message) return sendJson(response, 404, { error: "Mensagem nao encontrada" });
        const input = request.method === "PATCH" ? await readBody(request) : await readBody(request);
        if ((input.action === "edit" || request.method === "DELETE") && String(input.actorId) !== String(message.senderId)) return sendJson(response, 403, { error: "Somente o autor pode alterar esta mensagem" });
        if (request.method === "DELETE") chat.messages = chat.messages.filter(item => String(item.id) !== String(message.id));
        else {
            if (input.action === "pin") message.pinned = Boolean(input.pinned);
            if (input.action === "edit" && String(input.text || "").trim()) { message.text = String(input.text).trim(); message.edited = true; }
        }
        chat.updatedAt = Date.now();
        writeDatabase(database);
        return sendJson(response, 200, { chat });
    }

    if (request.method === "GET" && url.pathname === "/api/presence") return sendJson(response, 200, { presence: database.presence });
    if (request.method === "POST" && url.pathname === "/api/presence") {
        const input = await readBody(request);
        if (!input.userId) return sendJson(response, 400, { error: "userId obrigatorio" });
        database.presence[String(input.userId)] = { status: input.status === "offline" ? "offline" : "online", lastSeen: Date.now() };
        writeDatabase(database);
        return sendJson(response, 200, { presence: database.presence[String(input.userId)] });
    }

    if (request.method === "GET" && url.pathname === "/api/orders") {
        const merchantId = url.searchParams.get("merchantId");
        const clientId = url.searchParams.get("clientId");
        const orders = database.orders
            .filter(order => !merchantId && !clientId || merchantId && order.items.some(item => String(item.ownerId) === String(merchantId)) || clientId && String(order.clientId) === String(clientId))
            .map(order => merchantId ? { ...order, items: order.items.filter(item => String(item.ownerId) === String(merchantId)), total: order.items.filter(item => String(item.ownerId) === String(merchantId)).reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0) } : order);
        return sendJson(response, 200, { orders });
    }

    if (request.method === "POST" && url.pathname === "/api/products") {
        const input = await readBody(request);
        if (!input.ownerId) return sendJson(response, 400, { error: "ownerId obrigatorio" });
        const product = normalizeProduct(input);
        if (!product) return sendJson(response, 400, { error: "Produto invalido" });
        const existingIndex = database.products.findIndex(item =>
            (String(item.id) === product.id || (product.clientRequestId && String(item.clientRequestId) === product.clientRequestId)) &&
            String(item.ownerId) === product.ownerId
        );
        if (existingIndex >= 0) database.products[existingIndex] = { ...database.products[existingIndex], ...product };
        else database.products.push(product);
        writeDatabase(database);
        return sendJson(response, 201, { product });
    }

    const productUpdateMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
    if (request.method === "PATCH" && productUpdateMatch) {
        const input = await readBody(request);
        const product = database.products.find(item => item.id === decodeURIComponent(productUpdateMatch[1]));
        if (!product || String(input.ownerId) !== String(product.ownerId)) return sendJson(response, 404, { error: "Produto nao encontrado" });
        const updated = normalizeProduct({ ...product, ...input, id: product.id, ownerId: product.ownerId });
        database.products[database.products.indexOf(product)] = updated;
        writeDatabase(database);
        return sendJson(response, 200, { product: updated });
    }

    const purchaseMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/purchase$/);
    if (request.method === "POST" && purchaseMatch) {
        const product = database.products.find(item => item.id === decodeURIComponent(purchaseMatch[1]));
        if (!product) return sendJson(response, 404, { error: "Produto nao encontrado" });
        if (Number(product.quantity || 0) < 1) return sendJson(response, 409, { error: "Produto esgotado" });
        product.quantity -= 1;
        product.salesCount = Number(product.salesCount || 0) + 1;
        writeDatabase(database);
        return sendJson(response, 200, { product });
    }

    if (request.method === "POST" && url.pathname === "/api/orders") {
        const input = await readBody(request);
        const clientId = String(input.clientId || "");
        const clientName = String(input.clientName || "Cliente");
        const requestedItems = Array.isArray(input.items) ? input.items : [];
        if (!clientId || !requestedItems.length) return sendJson(response, 400, { error: "Pedido invalido" });
        const items = requestedItems.map(item => {
            const product = database.products.find(entry => String(entry.id) === String(item.productId));
            const quantity = Math.max(1, Number(item.quantity || 1));
            const variation = Array.isArray(product?.variations) ? product.variations.find(entry => String(entry.id) === String(item.variationId)) : null;
            const stock = variation ? Number(variation.quantity || 0) : Number(product?.quantity || 0);
            if (!product || stock < quantity) return null;
            return { productId: product.id, variationId: variation?.id || null, variation: variation ? { color: variation.color, size: variation.size } : null, ownerId: product.ownerId, ownerName: product.ownerName, name: product.name, category: product.category, price: product.price, quantity };
        });
        if (items.some(item => !item)) return sendJson(response, 409, { error: "Estoque insuficiente para um dos produtos" });
        const redemptionId = String(input.redemptionId || "");
        let descontoCupom = 0;
        const cuponsUsados = [];
        database.coupons = Array.isArray(database.coupons) ? database.coupons : [];
        for (const requestedCoupon of (Array.isArray(input.coupons) ? input.coupons : [])) {
            const code = String(requestedCoupon.code || "").trim();
            if (!code) continue;
            const couponCandidates = database.coupons.filter(c => String(c.code || "").toLowerCase() === code.toLowerCase() && c.active !== false);
            const coupon = couponCandidates.find(c => items.some(item => String(item.ownerId) === String(c.ownerId)));
            if (!coupon) return sendJson(response, 400, { error: `Cupom ${code} inválido ou indisponível para este carrinho` });
            if (coupon.start && new Date(coupon.start) > new Date()) return sendJson(response, 400, { error: `Cupom ${code} ainda não está válido` });
            if (coupon.end && new Date(coupon.end) < new Date()) return sendJson(response, 400, { error: `Cupom ${code} expirado` });
            if (coupon.limit && Number(coupon.used || 0) >= Number(coupon.limit)) return sendJson(response, 400, { error: `Cupom ${code} atingiu o limite de usos` });
            const eligible = items.filter(item => String(item.ownerId) === String(coupon.ownerId) && (coupon.scope === "all" || (coupon.scope === "category" && items.some(x => String(x.productId) === String(item.productId)) && String(database.products.find(p => String(p.id) === String(item.productId))?.category || "") === String(coupon.category || "")) || (coupon.scope === "product" && String(item.productId) === String(coupon.productId))));
            if (!eligible.length) return sendJson(response, 400, { error: `Cupom ${code} não se aplica aos produtos do carrinho` });
            const base = eligible.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
            descontoCupom += base * Math.min(100, Math.max(0, Number(coupon.discount || 0))) / 100;
            cuponsUsados.push(coupon);
        }
        let descontoFidelidade = 0;
        let resgateUsado = null;
        if (redemptionId) {
            database.loyaltyRedemptions = Array.isArray(database.loyaltyRedemptions)
                ? database.loyaltyRedemptions
                : [];
            const resgate = database.loyaltyRedemptions.find(
                r => String(r.id) === redemptionId &&
                    String(r.clientId) === clientId &&
                    !r.usedOrderId
            );
            if (!resgate) {
                return sendJson(response, 400, { error: "Resgate de fidelidade inválido ou já utilizado" });
            }
            const produtosDaLoja = items.filter(
                it => String(it.ownerId) === String(resgate.ownerId)
            );
            if (!produtosDaLoja.length) {
                return sendJson(response, 400, { error: "Este resgate só vale para produtos da mesma loja do cartão de fidelidade." });
            }
            descontoFidelidade = Number(resgate.descontoValor || 0);
            resgateUsado = resgate;
        }
        items.forEach(item => {
            const product = database.products.find(entry => String(entry.id) === String(item.productId));
            const variation = item.variationId && Array.isArray(product.variations) ? product.variations.find(entry => String(entry.id) === String(item.variationId)) : null;
            if (variation) variation.quantity -= item.quantity;
            product.quantity -= item.quantity;
            product.salesCount = Number(product.salesCount || 0) + item.quantity;
        });
        const fulfillment = input.fulfillment === "pickup" ? "pickup" : "delivery";
        const deliveryAddress = fulfillment === "delivery" && input.deliveryAddress && typeof input.deliveryAddress === "object" ? input.deliveryAddress : null;
        if (fulfillment === "delivery" && (!deliveryAddress?.recipient || !deliveryAddress.zip || !deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.state)) return sendJson(response, 400, { error: "Endereco de entrega obrigatorio" });
        const pickupLocations = fulfillment === "pickup" && Array.isArray(input.pickupLocations) ? input.pickupLocations : [];
        if (fulfillment === "pickup" && pickupLocations.some(location => !location?.location?.sector || !location.location.street || !location.location.box)) return sendJson(response, 400, { error: "Localizacao para retirada indisponivel" });
        const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
        const total = Math.max(0, subtotal - descontoFidelidade - descontoCupom);
        const order = { id: crypto.randomUUID(), clientId, clientName, fulfillment, deliveryAddress, pickupLocations, items, subtotal, descontoFidelidade, descontoCupom, cupons: cuponsUsados.map(c => ({ code: c.code, discount: Number(c.discount || 0), campaignId: c.id })), total, redemptionId: redemptionId || null, status: "recebido", createdAt: Date.now(), updatedAt: Date.now() };
        database.orders.push(order);
        for (const coupon of cuponsUsados) coupon.used = Number(coupon.used || 0) + 1;
        if (resgateUsado) {
            resgateUsado.usedOrderId = order.id;
            const pointsEntry = database.loyaltyPoints.find(
                lp => String(lp.cartaoId) === String(resgateUsado.cartaoId) &&
                    String(lp.clientId) === clientId
            );
            if (pointsEntry) {
                const cartao = database.loyaltyCards.find(c => String(c.id) === String(resgateUsado.cartaoId));
                const meta = Number(cartao?.metaPontos || 0);
                pointsEntry.pontos = Math.max(0, Number(pointsEntry.pontos || 0) - meta);
            }
        }
        writeDatabase(database);
        return sendJson(response, 201, { order, products: database.products });
    }

    const orderStatusMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (request.method === "PATCH" && orderStatusMatch) {
        const input = await readBody(request);
        const allowedStatuses = ["recebido", "preparando", "postado", "enviado", "entregue", "cancelado"];
        const order = database.orders.find(item => item.id === decodeURIComponent(orderStatusMatch[1]));
        if (!order || !allowedStatuses.includes(input.status)) return sendJson(response, 400, { error: "Status invalido" });
        const previousStatus = order.status;
        order.status = input.status;
        order.updatedAt = Date.now();
        if (previousStatus !== "entregue" && input.status === "entregue") {
            adicionarPontoFidelidade(database, order);
        }
        writeDatabase(database);
        return sendJson(response, 200, { order });
    }

    const orderDeleteMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (request.method === "DELETE" && orderDeleteMatch) {
        const input = await readBody(request);
        const orderIndex = database.orders.findIndex(item => item.id === decodeURIComponent(orderDeleteMatch[1]));
        const order = database.orders[orderIndex];
        const merchantId = String(input.merchantId || "");
        if (!order || !merchantId || order.status !== "entregue" || !order.items.some(item => String(item.ownerId) === merchantId)) return sendJson(response, 403, { error: "Somente o vendedor pode apagar pedidos entregues" });
        database.orders.splice(orderIndex, 1);
        writeDatabase(database);
        return sendJson(response, 200, { ok: true });
    }

    const orderConfirmMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/confirm$/);
    if (request.method === "PATCH" && orderConfirmMatch) {
        const input = await readBody(request);
        const order = database.orders.find(item => item.id === decodeURIComponent(orderConfirmMatch[1]));
        if (!order || String(order.clientId) !== String(input.clientId) || !["enviado", "entregue"].includes(order.status)) return sendJson(response, 403, { error: "O cliente ainda nao pode confirmar este pedido" });
        const previousStatus = order.status;
        order.status = "entregue";
        order.confirmedAt = Date.now();
        order.updatedAt = Date.now();
        if (previousStatus !== "entregue") {
            adicionarPontoFidelidade(database, order);
        }
        writeDatabase(database);
        return sendJson(response, 200, { order });
    }

    const ratingMatch = url.pathname.match(/^\/api\/products\/([^/]+)\/ratings$/);
    if (request.method === "POST" && ratingMatch) {
        const input = await readBody(request);
        const value = Number(input.value);
        const clientId = String(input.clientId || "");
        const product = database.products.find(item => item.id === decodeURIComponent(ratingMatch[1]));
        if (!product || !clientId || !Number.isInteger(value) || value < 1 || value > 5) return sendJson(response, 400, { error: "Avaliacao invalida" });
        const deliveredPurchase = database.orders.some(order => String(order.clientId) === clientId && order.status === "entregue" && order.items.some(item => String(item.productId) === String(product.id)));
        if (!deliveredPurchase) return sendJson(response, 403, { error: "A avaliacao so esta disponivel apos a entrega" });
        product.ratings = Array.isArray(product.ratings) ? product.ratings : [];
        const existing = product.ratings.find(rating => String(rating.clientId) === clientId);
        if (existing) { existing.value = value; if (input.media) existing.media = input.media; }
        else product.ratings.push({ clientId, value, media: input.media || null, createdAt: Date.now() });
        writeDatabase(database);
        return sendJson(response, 200, { product });
    }

    sendJson(response, 404, { error: "Rota nao encontrada" });
}

function serveStatic(response, urlPath) {
    const requested = urlPath === "/" ? "/index.html" : urlPath;
    const filePath = path.resolve(ROOT, `.${requested}`);
    if (!filePath.startsWith(`${ROOT}${path.sep}`)) return sendJson(response, 403, { error: "Acesso negado" });
    fs.readFile(filePath, (error, content) => {
        if (error) return sendJson(response, error.code === "ENOENT" ? 404 : 500, { error: "Arquivo nao encontrado" });
        response.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
        response.end(content);
    });
}

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    try {
        if (url.pathname.startsWith("/api/")) await handleApi(request, response, url);
        else serveStatic(response, url.pathname);
    } catch (error) {
        console.error(error);
        sendJson(response, 500, { error: "Erro interno" });
    }
});

server.listen("/tmp/moda.sock", () => console.log("listening on unix socket"));
