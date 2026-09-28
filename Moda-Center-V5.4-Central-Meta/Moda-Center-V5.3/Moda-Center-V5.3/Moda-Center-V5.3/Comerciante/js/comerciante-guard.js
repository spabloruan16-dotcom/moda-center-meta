// =========================================================
// PROTEÇÃO DAS PÁGINAS DO COMERCIANTE
// =========================================================
// Centraliza a sessão usada por todas as páginas da área do
// comerciante. cadastro-loja.js depende de window.comercianteSession,
// portanto este arquivo precisa ser carregado antes dele.
//
// A loja NÃO é validada aqui. A única responsabilidade do guard é:
// 1) recuperar a sessão;
// 2) garantir que a conta é de comerciante;
// 3) disponibilizar window.comercianteSession para as demais páginas.
//
// A existência da loja é verificada individualmente pela página
// de cadastro/login. Isso evita o loop "configura -> volta para
// configurar" quando o servidor está temporariamente indisponível.
// =========================================================

(() => {
    const SESSION_KEY = "modaCenterSession";

    let session = null;

    try {
        session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
        session = null;
    }

    if (!session?.id || session.profile !== "comerciante") {
        window.location.href = "../../index.html?login=1&area=comerciante";
        return;
    }

    window.comercianteSession = session;
})();
