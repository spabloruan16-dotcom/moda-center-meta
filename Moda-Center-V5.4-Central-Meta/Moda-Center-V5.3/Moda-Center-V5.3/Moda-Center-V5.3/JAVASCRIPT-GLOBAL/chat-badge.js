const CHAT_BADGE_DATABASE_KEY = "modaCenterChats";
const CHAT_BADGE_SESSION_KEY = "modaCenterSession";
const CHAT_BADGE_API_ENABLED = window.location.protocol !== "file:";

function getChatBadgeSession() { try { return JSON.parse(localStorage.getItem(CHAT_BADGE_SESSION_KEY) || "null"); } catch { return null; } }
function getChatBadgeChats() { try { const chats = JSON.parse(localStorage.getItem(CHAT_BADGE_DATABASE_KEY) || "[]"); return Array.isArray(chats) ? chats : []; } catch { return []; } }
function getChatBadgeCount(chat, session) { const counts = chat.unreadCounts || {}; const userId = String(session?.id || ""); return Number.isFinite(Number(counts[userId])) ? Number(counts[userId]) : (chat.unreadFor === userId ? 1 : 0); }
function getBadgeButton() { return document.getElementById("clientChatButton") || document.querySelector('.client-bottom-navigation a[href*="chat_comerciante.html"], .client-chat-navigation a[href*="chat_comerciante.html"], .merchant-chat-navigation .nav-item[data-page="chat_comerciante.html"], .bottom-navigation a[href*="chat_comerciante.html"]'); }
function keepPresenceOnline() {
    const session = getChatBadgeSession();
    if (!CHAT_BADGE_API_ENABLED || !session?.id) return;
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: session.id, status: "online" }) }).catch(() => {});
}
function paintChatBadge(total) {
    const button = getBadgeButton(); if (!button) return;
    let badge = button.querySelector(".chat-unread-badge");
    if (!total) { badge?.remove(); return; }
    if (!badge) { badge = document.createElement("span"); badge.className = "chat-unread-badge"; button.appendChild(badge); }
    badge.setAttribute("aria-label", `${total} mensagens não lidas`); badge.textContent = total > 99 ? "99+" : String(total);
}
async function updateChatBadge() {
    const session = getChatBadgeSession(); if (!session) return;
    if (CHAT_BADGE_API_ENABLED) {
        try {
            const response = await fetch(`/api/chats?userId=${encodeURIComponent(session.id)}`, { cache: "no-store" });
            if (response.ok) { const data = await response.json(); const chats = Array.isArray(data.chats) ? data.chats : []; localStorage.setItem(CHAT_BADGE_DATABASE_KEY, JSON.stringify(chats)); paintChatBadge(chats.reduce((sum, chat) => sum + getChatBadgeCount(chat, session), 0)); return; }
        } catch (_) {}
    }
    const chats = getChatBadgeChats().filter(chat => String(chat.clientId) === String(session.id) || String(chat.merchantId) === String(session.id));
    paintChatBadge(chats.reduce((sum, chat) => sum + getChatBadgeCount(chat, session), 0));
}
updateChatBadge();
keepPresenceOnline();
window.setInterval(keepPresenceOnline, 15000);
window.addEventListener("storage", event => { if (event.key === CHAT_BADGE_DATABASE_KEY || event.key === CHAT_BADGE_SESSION_KEY) updateChatBadge(); });
window.setInterval(updateChatBadge, 3000);
window.updateChatBadge = updateChatBadge;
