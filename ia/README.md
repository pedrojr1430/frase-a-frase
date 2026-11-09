# Lía — IA de conversação do Frase a Frase

O app conversa com a Lía por meio deste Worker do Cloudflare. A chave da OpenAI fica guardada só no Cloudflare, nunca no app publicado.

## Instalação (uma vez)

1. **OpenAI**: em https://platform.openai.com, crie a conta, adicione crédito em *Billing* e defina um limite mensal de gastos em *Limits*. Depois crie uma chave em *API keys*.
2. **Cloudflare**: em https://dash.cloudflare.com, crie uma conta gratuita. Vá em *Workers & Pages* > *Create* > *Create Worker*, dê o nome `lia` e clique em *Deploy*.
3. Clique em *Edit code*, apague o código de exemplo, cole o conteúdo de `worker.js` e clique em *Deploy*.
4. Em *Settings* > *Variables and Secrets*, adicione o **Secret** `OPENAI_API_KEY` com a chave da OpenAI.
5. Copie o endereço do Worker (algo como `https://lia.SEU-USUARIO.workers.dev`). Ele vai em `content/curso/curso.json`, no campo `ai.url`, e depois em `data/curso.json`.

## Variáveis opcionais
- `MODEL`: modelo da OpenAI (padrão `gpt-5-mini`).
- `ALLOWED_ORIGINS`: sites que podem usar a Lía (padrão `https://pedrojr1430.github.io`).

## Proteções
- Só aceita pedidos vindos do site do app.
- Limita cada IP a 30 mensagens a cada 10 minutos.
- Envia no máximo as 12 últimas mensagens da conversa e limita o tamanho das respostas.
- Mesmo assim, mantenha um limite mensal de gastos na OpenAI.
