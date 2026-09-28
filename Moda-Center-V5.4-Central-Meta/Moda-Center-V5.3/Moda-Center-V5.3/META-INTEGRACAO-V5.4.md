# Moda Center V5.4 — Central Meta (Instagram + Facebook)

## O que foi implementado

O painel de live agora possui destinos dedicados para:

- Instagram (Live Producer / RTMP ou RTMPS, quando disponível para a conta)
- Facebook (Live / RTMPS)
- YouTube
- Twitch
- Outro RTMP

A transmissão sai do navegador uma vez e o servidor FFmpeg distribui o sinal para os destinos habilitados.

## Instagram

1. Use uma conta profissional elegível.
2. No Instagram pelo computador, abra o fluxo de Live/Live Producer disponível para a conta.
3. Crie a sessão de live.
4. Copie a URL do servidor RTMP/RTMPS e a chave da sessão.
5. No Moda Center: abra uma live > Multistream > Instagram.
6. Cole URL e chave, marque Instagram e clique em "Salvar e transmitir agora".

A chave do Instagram deve ser tratada como credencial de sessão e pode mudar entre transmissões. Não reutilize uma chave antiga sem confirmar que a sessão atual continua válida.

## Facebook

1. Abra o fluxo de Live da Página/conta autorizada.
2. Obtenha a URL de ingestão RTMPS e a chave de transmissão.
3. No Moda Center: abra uma live > Multistream > Facebook.
4. Cole URL e chave, marque Facebook e inicie o multistream.

## Segurança

As chaves são armazenadas no banco JSON atual do projeto e aparecem mascaradas na interface. Para produção comercial, recomenda-se migrar essas credenciais para armazenamento criptografado/secret manager.

## Limitação importante

A V5.4 não finge ter uma integração OAuth da Meta. O fluxo de Instagram usa a sessão RTMP fornecida pela própria plataforma quando disponível para a conta, e o Facebook usa as credenciais de ingestão autorizadas. Uma futura versão pode adicionar OAuth/Graph API para gerenciamento de Páginas, criação automática de lives e leitura de métricas, após configuração e aprovação do aplicativo Meta.
