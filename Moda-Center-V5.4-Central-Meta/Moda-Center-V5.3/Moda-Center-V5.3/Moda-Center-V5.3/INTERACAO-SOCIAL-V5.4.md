# Moda Center V5.4 — Interação Social em Lives e Publicações

## Lives

- Chat ao vivo persistido no servidor.
- Cliente pode enviar mensagens durante a transmissão.
- Cliente pode solicitar participação na live.
- Comerciante recebe a fila de pedidos e pode aceitar ou recusar.
- Ao aceitar, a conexão WebRTC é renegociada para permitir áudio/vídeo bidirecional.
- O vídeo do participante aparece no painel da live do comerciante.
- O participante pode sair fechando a live; o servidor remove a participação aprovada.

## Publicações

- Curtir/descurtir.
- Contador de curtidas.
- Comentários persistidos.
- Compartilhamentos registrados.
- Botão de compartilhamento usa a API nativa do navegador quando disponível.

## APIs principais

- `GET/POST /api/live/:id/social`
- `POST /api/live/:id/participation/:requestId`
- `GET/POST /api/videos/:id/social`
- `POST /api/videos/:id/like`
- `POST /api/videos/:id/comments`
- `POST /api/videos/:id/share`

## Observação de produção

O protótipo usa polling curto para o chat e a fila de participação, enquanto o áudio/vídeo continua em WebRTC. Para escala grande, a próxima evolução pode trocar o polling social por WebSocket e usar Redis/pub-sub para distribuir eventos entre várias instâncias do servidor.

WebRTC suporta mídia em tempo real e canais de dados; o projeto usa o servidor para sinalização e mantém a mídia da live em WebRTC. WebSocket é uma opção apropriada para uma futura camada social de eventos em tempo real.
