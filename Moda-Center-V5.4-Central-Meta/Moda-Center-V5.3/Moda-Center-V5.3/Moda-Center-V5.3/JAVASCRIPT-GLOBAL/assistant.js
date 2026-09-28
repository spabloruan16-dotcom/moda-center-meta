window.addEventListener("DOMContentLoaded", () => {
  initAssistantWidget();

  const pagePath = window.location.pathname;
  let steps = [];

  if (pagePath.includes("produto-novo")) {
    steps = [
      {
        title: "📦 Cadastro de Novo Produto",
        text: "Aqui você adiciona novos itens ao catálogo da sua loja. Preencha as informações com atenção para atratividade do seu anúncio.",
        btnText: "Próximo"
      },
      {
        title: "🏷️ Categoria e Informações",
        text: "Escolha o <strong>Tipo de produto</strong> adequado e defina o nome, preço e quantidade disponível do item.",
        btnText: "Próximo"
      },
      {
        title: "🎨 Variações e Atacado",
        text: "Cadastre opções de <strong>cor e tamanho</strong> e ative a opção de <strong>venda no atacado</strong> caso ofereça descontos em quantidade.",
        btnText: "Próximo"
      },
      {
        title: "📸 Imagem e Confirmação",
        text: "Adicione uma boa foto do produto e clique em <strong>Cadastrar produto</strong> ao final para publicar o item na sua loja.",
        btnText: "Entendi!"
      }
    ];
  } else if (pagePath.includes("marketing")) {
    steps = [
      {
        title: "📣 Central de Marketing",
        text: "Bem-vindo à sua Central de Marketing! Aqui você encontra soluções para atrair clientes, aumentar suas vendas e promover sua marca no Moda Center.",
        btnText: "Próximo"
      },
      {
        title: "🏷️ Promoções e Ofertas Relâmpago",
        text: "Crie campanhas de desconto exclusivas para a sua loja através dos botões <strong>Promoções</strong> e <strong>Ofertas e Relâmpago da Loja</strong>.",
        btnText: "Próximo"
      },
      {
        title: "📊 Campanhas Ativas",
        text: "Acompanhe na seção <strong>'Campanhas que estão rodando'</strong> todas as promoções que estão ativas no momento para os seus clientes.",
        btnText: "Próximo"
      },
      {
        title: "💡 Dicas de Vendas",
        text: "Consulte o banner de <strong>Dicas para vender mais</strong> para conferir tutoriais, estratégias de divulgação e conteúdos voltados para o comércio do Moda Center.",
        btnText: "Entendi!"
      }
    ];
  } else if (pagePath.includes("chat")) {
    steps = [
      {
        title: "💬 Central de Mensagens",
        text: "Esta é sua central de conversas! Aqui você se comunica diretamente com clientes para tirar dúvidas, negociar e acompanhar pedidos.",
        btnText: "Próximo"
      },
      {
        title: "🔎 Buscando Conversas",
        text: "Utilize a barra <strong>'Pesquise algo ou alguém...'</strong> no topo para encontrar mensagens antigas ou localizar conversas com clientes específicos.",
        btnText: "Próximo"
      },
      {
        title: "➕ Iniciar Mensagem",
        text: "Clique no botão flutuante <strong>+</strong> ou no ícone no cabeçalho para visualizar seus contatos e iniciar uma nova conversa.",
        btnText: "Próximo"
      },
      {
        title: "🤖 Suporte do Robô",
        text: "Caso precise de ajuda para localizar setores ou tirar dúvidas sobre o sistema, clique no ícone do <strong>Robô Guia</strong> no canto superior.",
        btnText: "Entendi!"
      }
    ];
  } else if (pagePath.includes("perfil")) {
    steps = [
      {
        title: "👤 Perfil da Loja",
        text: "Aqui você gerencia a identidade da sua loja e acompanha suas métricas: total de vendas, catálogo ativo e nota de avaliação.",
        btnText: "Próximo"
      },
      {
        title: "✏️ Editar Dados e Localização",
        text: "Clique em <strong>'Editar meu perfil'</strong> para atualizar a foto da loja, alterar os segmentos de venda e manter o Setor, Rua e Box atualizados.",
        btnText: "Próximo"
      },
      {
        title: "📊 Relatórios e Atalhos",
        text: "Utilize os atalhos para abrir seus <strong>Relatórios de vendas</strong>, consultar <strong>Minhas avaliações</strong> ou visualizar as <strong>Últimas vendas</strong>.",
        btnText: "Próximo"
      },
      {
        title: "⚙️ Configurações",
        text: "No ícone de engrenagem <strong>⚙</strong> no topo, você gerencia preferências de notificações, dados de segurança ou encerra sua sessão.",
        btnText: "Entendi!"
      }
    ];
  } else if (pagePath.includes("cliente")) {
    steps = [
      {
        title: "🛍️ Bem-vindo(a) ao Moda Center!",
        text: "Aqui você encontra as melhores ofertas diretamente das lojas cadastradas. Vamos conferir como explorar a plataforma?",
        btnText: "Próximo"
      },
      {
        title: "✨ Studio de Estilo & IA",
        text: "Acesse <strong>Montar look com IA</strong> para combinações personalizadas ou use o <strong>Espelho Mágico</strong> para visualizar as peças.",
        btnText: "Próximo"
      },
      {
        title: "🔎 Catálogo de Produtos",
        text: "Utilize a barra de pesquisa para buscar roupas e acessórios específicos, veja detalhes dos itens e adicione ao seu carrinho.",
        btnText: "Próximo"
      },
      {
        title: "🛒 Pedidos e Navegação",
        text: "Acompanhe seus itens no <strong>Carrinho</strong>, veja o histórico em <strong>Minhas compras</strong> e fale diretamente com as lojas no <strong>Chat</strong>.",
        btnText: "Boas compras!"
      }
    ];
  } else {
    steps = [
      {
        title: "👋 Bem-vindo(a), Comerciante!",
        text: "Este é o seu painel central no Moda Center. A partir daqui você tem acesso rápido a todo o gerenciamento da sua loja.",
        btnText: "Próximo"
      },
      {
        title: "👕 Seus Produtos e Pedidos",
        text: "Na seção <strong>'Seus produtos'</strong> você visualiza seu catálogo e acessa diretamente a aba <strong>📦 Pedidos dos clientes</strong>.",
        btnText: "Próximo"
      },
      {
        title: "⚡ Atalhos Rápidos",
        text: "Utilize os botões de atalho para <strong>Cadastrar novo produto</strong> (➕), filtrar por categorias ou gerenciar seus itens em estoque.",
        btnText: "Próximo"
      },
      {
        title: "🧭 Menu Inferior",
        text: "Navegue facilmente entre a tela de <strong>Início</strong>, responda seus clientes no <strong>Chat</strong>, crie campanhas em <strong>Marketing</strong> e edite seu <strong>Perfil</strong>.",
        btnText: "Começar!"
      }
    ];
  }

  initTutorialSystem(steps);
});

// =========================================================
// BASE DE DADOS DE DÚVIDAS E SOLUÇÕES (FAQ)
// =========================================================
const faqDatabase = {
  cliente: [
    {
      q: "Como faço para acompanhar meu pedido?",
      a: "Acesse a aba <strong>'Minhas compras'</strong> no menu inferior para ver o status em tempo real de cada pedido efetuado."
    },
    {
      q: "Como entrar em contato com um comerciante?",
      a: "Na página do produto ou pelo menu de navegação, clique na opção <strong>'Conversas / Chat'</strong> para falar diretamente com a loja."
    },
    {
      q: "Quais as formas de recebimento dos produtos?",
      a: "No momento da compra você pode optar por <strong>Retirar na loja</strong> (no box informado) ou receber via <strong>Entrega no seu endereço</strong>."
    },
    {
      q: "Como funciona o Espelho Mágico?",
      a: "Na tela inicial de compras, acesse o <strong>Espelho Mágico</strong> e suba uma foto sua para pré-visualizar as combinações de peças oferecidas na plataforma."
    }
  ],
  comerciante: [
    {
      q: "Como cadastrar novos produtos na minha loja?",
      a: "Clique no botão flutuante <strong>(+)</strong> no canto inferior ou acesse o menu de cadastro. Preencha nome, valor, foto, estoque e variações do produto."
    },
    {
      q: "Como ativar preços para vendas no Atacado?",
      a: "Na tela de cadastrar ou editar produto, marque a caixa <strong>'Vendo este produto no atacado'</strong>, informe a quantidade mínima e o preço especial por peça."
    },
    {
      q: "Como criar promoções na Central de Marketing?",
      a: "Vá para a aba <strong>Marketing</strong> no menu inferior, selecione <strong>'Promoções'</strong> ou <strong>'Ofertas Relâmpago'</strong> e defina a porcentagem de desconto desejada."
    },
    {
      q: "Como alterar dados como Setor, Rua e Box da loja?",
      a: "Acesse a aba <strong>Perfil</strong> no menu inferior, clique no botão <strong>'Editar meu perfil'</strong> e atualize as informações de localização da sua loja."
    }
  ]
};

// =========================================================
// WIDGET DO ROBÔ GUIA & CENTRAL DE AJUDA
// =========================================================
function initAssistantWidget() {
  if (document.getElementById("assistant-container")) return;

  const container = document.createElement("div");
  container.id = "assistant-container";
  container.innerHTML = `
    <div id="assistant-box" class="hidden">
      <div class="assistant-header">
        <span>🤖 Guia Moda Center</span>
        <button id="close-btn">&times;</button>
      </div>
      <div class="assistant-body">
        <input type="text" id="faqSearch" class="assistant-search-input" placeholder="🔍 Buscar dúvida ou problema...">
        
        <div class="assistant-tabs">
          <button class="tab-btn active" id="tabCliente" type="button">Sou Cliente</button>
          <button class="tab-btn" id="tabComerciante" type="button">Sou Comerciante</button>
        </div>

        <button id="openTutorialBtn" class="assistant-tutorial-btn" type="button">🎓 Ver tutorial desta tela</button>

        <div id="faqList"></div>
      </div>
    </div>
    <button id="assistant-avatar" aria-label="Guia do Site">
      <span style="font-size: 24px;">🤖</span>
    </button>
  `;
  document.body.appendChild(container);

  const box = document.getElementById("assistant-box");
  const avatar = document.getElementById("assistant-avatar");
  const closeBtn = document.getElementById("close-btn");
  const tabCliente = document.getElementById("tabCliente");
  const tabComerciante = document.getElementById("tabComerciante");
  const searchInput = document.getElementById("faqSearch");

  const currentPath = window.location.pathname.toLowerCase();
  let currentCategory = (
    currentPath.includes("cliente") ||
    currentPath.includes("minhas-compras") ||
    currentPath.includes("perfil_cliente")
  ) ? "cliente" : "comerciante";

  function renderFAQ(filterText = "") {
    const listContainer = document.getElementById("faqList");
    listContainer.innerHTML = "";

    if (currentCategory === "cliente") {
      tabCliente.classList.add("active");
      tabComerciante.classList.remove("active");
    } else {
      tabComerciante.classList.add("active");
      tabCliente.classList.remove("active");
    }

    const items = faqDatabase[currentCategory].filter(item => 
      item.q.toLowerCase().includes(filterText.toLowerCase()) || 
      item.a.toLowerCase().includes(filterText.toLowerCase())
    );

    if (items.length === 0) {
      listContainer.innerHTML = `<p style="font-size:12px; color:#777; text-align:center; padding: 10px;">Nenhuma dúvida encontrada.</p>`;
      return;
    }

    items.forEach((item, idx) => {
      const faqItem = document.createElement("div");
      faqItem.className = "faq-item";
      faqItem.innerHTML = `
        <button class="faq-question">
          <span>${item.q}</span>
          <span style="font-size:10px;">▼</span>
        </button>
        <div class="faq-answer">${item.a}</div>
      `;

      faqItem.querySelector(".faq-question").addEventListener("click", () => {
        faqItem.classList.toggle("open");
        placeBox(false);
      });

      listContainer.appendChild(faqItem);
    });
  }

  // =======================================================
  // ROBÔ ARRASTÁVEL
  // Começa no canto superior esquerdo (definido no CSS). O usuário
  // pode arrastar o robô (dedo ou mouse) e soltá-lo onde quiser; a
  // caixa de ajuda acompanha e sempre abre para o lado com espaço.
  // A posição fica guardada enquanto a aba/app estiver aberta, então
  // continua no mesmo lugar ao trocar de tela. Ao abrir de novo, volta
  // para o canto superior esquerdo.
  // =======================================================
  const POS_KEY = "modaCenterAssistantPos";
  const EDGE = 6;            // folga mínima da borda da tela
  const DRAG_THRESHOLD = 6;  // px de movimento para contar como arrasto (e não como toque)
  let drag = null;
  let lastDragEnd = 0;
  let boxSide = "below";
  let lastViewportWidth = window.innerWidth;

  function viewportSize() {
    return {
      w: document.documentElement.clientWidth || window.innerWidth,
      h: window.innerHeight
    };
  }

  function clampPosition(x, y) {
    const { w, h } = viewportSize();
    const size = container.offsetWidth || 45;
    return {
      x: Math.min(Math.max(x, EDGE), Math.max(EDGE, w - size - EDGE)),
      y: Math.min(Math.max(y, EDGE), Math.max(EDGE, h - size - EDGE))
    };
  }

  function setPosition(x, y) {
    const pos = clampPosition(x, y);
    container.style.left = pos.x + "px";
    container.style.top = pos.y + "px";
    return pos;
  }

  function savePosition() {
    const { w, h } = viewportSize();
    const size = container.offsetWidth || 45;
    const rect = container.getBoundingClientRect();
    // Guarda a posição em proporção da tela para acompanhar a rotação do celular.
    const data = {
      fx: rect.left / Math.max(1, w - size),
      fy: rect.top / Math.max(1, h - size)
    };
    try { sessionStorage.setItem(POS_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function restorePosition() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(POS_KEY) || "null"); } catch (_) {}
    if (!data || typeof data.fx !== "number" || typeof data.fy !== "number") return;
    const { w, h } = viewportSize();
    const size = container.offsetWidth || 45;
    setPosition(data.fx * (w - size), data.fy * (h - size));
  }

  // Coloca a caixa de ajuda dentro da tela: abre para baixo ou para cima
  // (o que couber) e desliza para o lado se o robô estiver perto da borda.
  function placeBox(chooseSide = true) {
    if (box.classList.contains("hidden")) return;

    const GAP = 10;
    const MARGIN = 8;
    const { w, h } = viewportSize();

    box.style.maxHeight = "";
    const anchor = container.getBoundingClientRect();
    const boxWidth = box.offsetWidth;
    const boxHeight = box.offsetHeight;

    const left = Math.min(Math.max(anchor.left, MARGIN), Math.max(MARGIN, w - boxWidth - MARGIN));
    box.style.left = (left - anchor.left) + "px";

    const roomBelow = h - anchor.bottom - GAP - MARGIN;
    const roomAbove = anchor.top - GAP - MARGIN;

    if (chooseSide) {
      if (boxHeight <= roomBelow) boxSide = "below";
      else if (boxHeight <= roomAbove) boxSide = "above";
      else boxSide = roomBelow >= roomAbove ? "below" : "above";
    }

    const room = boxSide === "below" ? roomBelow : roomAbove;
    if (boxHeight > room) box.style.maxHeight = Math.max(room, 140) + "px";

    if (boxSide === "below") {
      box.style.top = `calc(100% + ${GAP}px)`;
      box.style.bottom = "auto";
    } else {
      box.style.top = "auto";
      box.style.bottom = `calc(100% + ${GAP}px)`;
    }
  }

  if (avatar) {
    avatar.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const rect = container.getBoundingClientRect();
      drag = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false
      };
      try { avatar.setPointerCapture(event.pointerId); } catch (_) {}
    });

    avatar.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;

      if (!drag.moved) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (distance < DRAG_THRESHOLD) return;
        drag.moved = true;
        container.classList.add("dragging");
      }

      event.preventDefault();
      setPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
      placeBox(true);
    });

    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved) {
        lastDragEnd = Date.now();
        savePosition();
      }
      container.classList.remove("dragging");
      try { avatar.releasePointerCapture(event.pointerId); } catch (_) {}
      drag = null;
    };
    avatar.addEventListener("pointerup", finishDrag);
    avatar.addEventListener("pointercancel", finishDrag);

    // Evita o menu de contexto do toque longo atrapalhar o arrasto no celular.
    avatar.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  // Ao girar o celular ou redimensionar, mantém o robô visível.
  window.addEventListener("resize", () => {
    const widthChanged = window.innerWidth !== lastViewportWidth;
    lastViewportWidth = window.innerWidth;

    if (widthChanged) {
      restorePosition(); // rotação: reaplica a posição proporcional guardada
    } else if (container.style.left || container.style.top) {
      const rect = container.getBoundingClientRect();
      setPosition(rect.left, rect.top); // só a altura mudou (barra do navegador): apenas garante que está visível
    }
    placeBox(true);
  });

  restorePosition();

  // Eventos de clique
  if (avatar) avatar.addEventListener("click", () => {
    // Soltar o robô depois de arrastar não deve abrir/fechar a caixa.
    if (Date.now() - lastDragEnd < 350) return;
    box.classList.toggle("hidden");
    renderFAQ();
    placeBox(true);
  });

  if (closeBtn) closeBtn.addEventListener("click", () => box.classList.add("hidden"));

  tabCliente.addEventListener("click", () => {
    currentCategory = "cliente";
    renderFAQ(searchInput.value);
    placeBox(false);
  });

  tabComerciante.addEventListener("click", () => {
    currentCategory = "comerciante";
    renderFAQ(searchInput.value);
    placeBox(false);
  });

  searchInput.addEventListener("input", (e) => {
    renderFAQ(e.target.value);
    placeBox(false);
  });

  const openTutorialBtn = document.getElementById("openTutorialBtn");
  if (openTutorialBtn) {
    openTutorialBtn.addEventListener("click", () => {
      if (typeof window.openAssistantTutorial === "function") {
        window.openAssistantTutorial();
      }
    });
  }

  renderFAQ();
}

function initTutorialSystem(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return;

  let tutorialModal = document.getElementById("tutorialModal");

  // A V5.1 não possui um modal fixo em todas as páginas. Criamos o componente
  // aqui para que o tutorial funcione em qualquer tela que carregue assistant.js.
  if (!tutorialModal) {
    tutorialModal = document.createElement("div");
    tutorialModal.id = "tutorialModal";
    tutorialModal.className = "tutorial-modal hidden";
    tutorialModal.setAttribute("role", "dialog");
    tutorialModal.setAttribute("aria-modal", "true");
    tutorialModal.setAttribute("aria-labelledby", "tutorialTitle");
    tutorialModal.innerHTML = `
      <div class="tutorial-card">
        <span class="assistant-icon" aria-hidden="true">🤖</span>
        <h2 id="tutorialTitle"></h2>
        <div class="tutorial-body">
          <p id="tutorialText"></p>
        </div>
        <div id="tutorialDots" class="tutorial-steps-indicator" aria-label="Etapas do tutorial"></div>
        <div class="tutorial-footer">
          <button id="skipTutorialBtn" class="btn-secondary" type="button">Pular</button>
          <button id="prevTutorialBtn" class="btn-secondary tutorial-prev-btn" type="button">Voltar</button>
          <button id="nextTutorialBtn" class="btn-primary" type="button">Próximo</button>
        </div>
      </div>
    `;
    document.body.appendChild(tutorialModal);
  }

  const tutorialTitle = document.getElementById("tutorialTitle");
  const tutorialText = document.getElementById("tutorialText");
  const nextTutorialBtn = document.getElementById("nextTutorialBtn");
  const prevTutorialBtn = document.getElementById("prevTutorialBtn");
  const skipTutorialBtn = document.getElementById("skipTutorialBtn");
  const dotsContainer = document.getElementById("tutorialDots");

  if (!tutorialTitle || !tutorialText || !nextTutorialBtn || !dotsContainer) return;

  const pageKey = ("/" + (window.location.pathname.split("/").pop() || "inicio")).replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const storageKey = `modaCenterAssistantTutorial_${pageKey}`;
  let currentStep = 0;

  dotsContainer.innerHTML = steps.map((_, index) =>
    `<span class="step-dot${index === 0 ? " active" : ""}" aria-hidden="true"></span>`
  ).join("");

  const dots = Array.from(dotsContainer.querySelectorAll(".step-dot"));

  function closeTutorial(markSeen = true) {
    tutorialModal.classList.add("hidden");
    tutorialModal.style.display = "none";
    if (markSeen) {
      try { localStorage.setItem(storageKey, "1"); } catch (_) {}
    }
  }

  function updateStepView() {
    const step = steps[currentStep];
    tutorialTitle.innerHTML = step.title || "Guia Moda Center";
    tutorialText.innerHTML = step.text || "";
    nextTutorialBtn.textContent = step.btnText || (currentStep === steps.length - 1 ? "Concluir" : "Próximo");

    dots.forEach((dot, index) => dot.classList.toggle("active", index === currentStep));

    if (prevTutorialBtn) {
      prevTutorialBtn.style.display = currentStep === 0 ? "none" : "inline-flex";
    }

    if (skipTutorialBtn) {
      skipTutorialBtn.textContent = currentStep === steps.length - 1 ? "Fechar" : "Pular";
    }
  }

  function openTutorial(force = true) {
    currentStep = 0;
    updateStepView();
    tutorialModal.classList.remove("hidden");
    tutorialModal.style.display = "flex";
    if (force) {
      try { localStorage.removeItem(storageKey); } catch (_) {}
    }
  }

  window.openAssistantTutorial = openTutorial;

  nextTutorialBtn.onclick = () => {
    if (currentStep < steps.length - 1) {
      currentStep += 1;
      updateStepView();
    } else {
      closeTutorial(true);
    }
  };

  if (prevTutorialBtn) {
    prevTutorialBtn.onclick = () => {
      if (currentStep > 0) {
        currentStep -= 1;
        updateStepView();
      }
    };
  }

  if (skipTutorialBtn) skipTutorialBtn.onclick = () => closeTutorial(true);

  tutorialModal.onclick = (event) => {
    if (event.target === tutorialModal) closeTutorial(true);
  };

  document.addEventListener("keydown", (event) => {
    if (tutorialModal.classList.contains("hidden")) return;
    if (event.key === "Escape") closeTutorial(true);
    if (event.key === "ArrowRight") nextTutorialBtn.click();
    if (event.key === "ArrowLeft" && prevTutorialBtn && currentStep > 0) prevTutorialBtn.click();
  });

  updateStepView();

  // Mostra automaticamente apenas na primeira visita daquela tela.
  let alreadySeen = false;
  try { alreadySeen = localStorage.getItem(storageKey) === "1"; } catch (_) {}
  if (!alreadySeen) {
    window.setTimeout(() => openTutorial(false), 350);
  } else {
    tutorialModal.classList.add("hidden");
    tutorialModal.style.display = "none";
  }
}

