# Frase a Frase para Android

App Android (Trusted Web Activity) que abre https://pedrojr1430.github.io/frase-a-frase/ em tela cheia.

- Pacote: `io.github.pedrojr1430.fraseafrase`
- Gerado com Bubblewrap; compilado e assinado pelo workflow `.github/workflows/apk.yml` a cada mudança nesta pasta.
- Download: https://github.com/pedrojr1430/frase-a-frase/releases/latest/download/frase-a-frase.apk
- Assinatura: `frase-a-frase.keystore` (alias `fraseafrase`); a senha fica no segredo `KEYSTORE_PASSWORD`.
- Verificação do domínio: `https://pedrojr1430.github.io/.well-known/assetlinks.json` (repositório pedrojr1430.github.io).
- Para publicar uma versão nova do app, aumente `versionCode` e `versionName` em `app/build.gradle`.
