# Login do Frase a Frase — como ligar

**Situação (22/11/2026): tudo configurado e no ar.** Projeto Supabase `ladrodxlghsfkebimisi`, Google Cloud `frase-a-frase-515514` (app em produção), e-mails enviados pelo Gmail pedrolima1430@gmail.com (smtp.gmail.com:465 com senha de app "Frase a Frase"), modelos de e-mail de confirmação e de nova senha em português. O passo a passo abaixo fica como referência.

O código do login já está no app (`conta.js`). Enquanto `CONFIG.url` e `CONFIG.anonKey` estiverem vazios, o menu mostra "Entrar" com o aviso de que o login está sendo configurado, e tudo continua funcionando só no aparelho.

Endereço do app: `https://pedrojr1430.github.io/frase-a-frase/`

## 1. Supabase (login + banco)
1. Criar conta em supabase.com e um projeto novo (região: São Paulo).
2. SQL Editor → New query → colar todo o `supabase/schema.sql` → Run.
3. Authentication → URL Configuration:
   - Site URL: `https://pedrojr1430.github.io/frase-a-frase/`
   - Redirect URLs: `https://pedrojr1430.github.io/frase-a-frase/**`
4. Authentication → Sign In / Providers → Email: ligado, "Confirm email" ligado, senha mínima 8.
5. Project Settings → API: copiar a **Project URL** e a chave **anon public** e mandar para o Claude (as duas podem ficar no site). Nunca mandar a `service_role`.

## 2. Google (botão "Continuar com Google")
1. console.cloud.google.com → criar projeto "Frase a Frase".
2. APIs e serviços → Tela de consentimento OAuth (Google Auth Platform): tipo Externo; nome "Frase a Frase"; e-mail de suporte; domínio autorizado `supabase.co`; link da política: `https://pedrojr1430.github.io/frase-a-frase/privacidade.html`. Publicar o app (sair do modo "Teste") para qualquer pessoa conseguir entrar.
3. Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web.
   - Origens JavaScript autorizadas: `https://pedrojr1430.github.io`
   - URIs de redirecionamento autorizados: `https://SEU-PROJETO.supabase.co/auth/v1/callback` (aparece no Supabase em Authentication → Providers → Google).
4. No Supabase → Authentication → Providers → Google: ligar e colar o Client ID e o Client Secret. O segredo fica só no Supabase.

## 3. E-mails (confirmação de conta e "Esqueci minha senha")
O envio padrão do Supabase só entrega para os membros da equipe do projeto (no máximo 2 por hora). Para qualquer pessoa receber, ligar um SMTP próprio:
1. Criar conta grátis no Brevo (300 e-mails por dia) ou no Resend.
2. Brevo → SMTP & API → gerar uma **chave SMTP** e verificar o remetente (o e-mail que vai aparecer como "de").
3. Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:
   - Host `smtp-relay.brevo.com`, porta `587`, usuário e senha = login SMTP e chave SMTP do Brevo.
   - Remetente: nome "Frase a Frase" e o e-mail verificado.
4. (Opcional) Traduzir os modelos em Authentication → Emails → Templates ("Confirm signup" e "Reset password").

## 4. Ligar no app
Preencher no topo do `conta.js`:
```js
var CONFIG = { url: 'https://SEU-PROJETO.supabase.co', anonKey: 'CHAVE_ANON' };
```
Subir o `?v=` do `conta.js` no index.html e no sw.js, e a versão do service worker.

## Como funciona
- Login opcional, com Google ou e-mail e senha. "Esqueci minha senha" manda um link; ao abrir, o app pede a senha nova.
- Tabela `progresso`: uma linha por chave `fraseafrase.*` (menos `trcache` e `sync`). Cada pessoa só vê o próprio progresso (RLS).
- Cada gravação no aparelho é enviada uns 2 segundos depois (e ao sair do app). Ao abrir, o app baixa o que mudou em outro aparelho; vence a alteração mais recente de cada chave.
- No primeiro login em um aparelho que já tem progresso, e a conta também tem, o app pergunta qual manter.
- Excluir conta: chama `excluir_minha_conta()` (apaga o usuário e o progresso) e limpa o aparelho.
