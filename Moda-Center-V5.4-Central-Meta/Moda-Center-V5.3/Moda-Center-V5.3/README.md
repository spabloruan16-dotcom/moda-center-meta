# Moda Center V5.2

Esta pasta e uma copia independente da V5. Ela preserva catalogo, lojas, pedidos, chats e a interface visual, mas prepara a autenticacao para MySQL com bcrypt.

## Rodar localmente

```powershell
npm install
npm start
```

Abra `http://localhost:3000`.

Por padrao, a aplicacao usa `server/data.json`, para continuar funcionando sem MySQL. Para ativar MySQL:

1. Copie `.env.example` para `.env`.
2. Altere `DB_MODE=mysql` e preencha as credenciais.
3. Crie o banco e a tabela executando `schema.sql` no MySQL.
4. Inicie com `npm start`.

A tabela `usuarios` armazena apenas o hash da senha. O cadastro e login aceitam as rotas atuais `/api/auth/register` e `/api/auth/login`, alem dos aliases `/api/register` e `/api/login`.

Teste a conexao com:

```powershell
npm run db:check
```

O arquivo `.env` nao deve ser enviado ao GitHub.

## Estrutura de pastas

```
index.html            pagina inicial (login/cadastro)
assets/               imagens (assets/images)
CSS-GLOBAL/           CSS usado por mais de uma area (global, navigation, assistant)
JAVASCRIPT-GLOBAL/    JS usado por mais de uma area (main, assistant, chat-badge, nota-pedido)
Cliente/              pages/ (html), css/, js/
Comerciante/          pages/ (html), css/, js/
Administracao/        pages/ (html), css/, js/
server.js, database.js, auth-database.js, server/, data/   servidor e dados
```

O chat (`Comerciante/pages/chat_comerciante.html`) e usado tambem pelos clientes.


## Live e Vídeos reais
- Live usa WebRTC com sinalização no servidor.
- Vídeos são enviados para uploads/videos e ficam disponíveis em Cliente/pages/live_videos.html.
- A publicação não exige produto vinculado.
