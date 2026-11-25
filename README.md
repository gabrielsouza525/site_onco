# Site — Dr. Bruno Kersten | Oncologia Clínica

Site institucional estático do Dr. Bruno Kersten, médico oncologista em Araçatuba/SP.
O conteúdo foi construído a partir do documento original de referência e a estrutura de
navegação segue o formato de **portal de informação ao paciente**, inspirado no site do
Instituto Oncoguia (menu por temas, acesso rápido, área de conteúdos, busca interna e
rodapé com múltiplas colunas).

Não há dependências, framework ou etapa de compilação obrigatória para publicar: o HTML
final fica versionado na raiz do repositório.

---

## Estrutura

```
.
├── index.html                    ← páginas geradas (não editar à mão)
├── sobre.html
├── atuacao.html
├── jornada.html
├── prevencao.html
├── artigos.html                  ← + uma página por artigo (artigo-*.html)
├── tipos-de-cancer.html          ← + uma página por tipo (cancer-*.html)
├── contato.html
├── busca.html
├── 404.html
│
├── build.js                      ← gerador (Node, sem dependências)
├── scripts/pacote.js             ← monta o zip para a hospedagem
├── admin/                        ← painel administrativo (PHP)
├── assistente/                   ← assistente virtual (PHP + Google Gemini)
├── src/
│   ├── layout.html               ← esqueleto <head>/<body> comum
│   ├── partials/
│   │   ├── header.html           ← barra de aviso, logo, menu, busca
│   │   └── footer.html           ← rodapé
│   └── pages/                    ← conteúdo de cada página
│
└── assets/
    ├── css/styles.css            ← design system completo
    ├── js/main.js                ← menu, carrossel, busca, formulários
    ├── js/assistente.js          ← janela do assistente virtual
    ├── js/search-index.js        ← gerado pelo build.js
    └── img/                      ← logo e favicon (SVG)
```

## Como editar

O cabeçalho e o rodapé são compartilhados: edite-os **uma vez** em `src/partials/` e
regenere as páginas.

```bash
node build.js      # ou: npm run build
```

Para editar o conteúdo de uma página, altere o arquivo correspondente em `src/pages/` e
rode o build novamente. Título, descrição e palavras-chave de busca de cada página ficam
no array `PAGES`, no topo de `build.js`.

## Como visualizar localmente

```bash
npx http-server -p 8080 .     # ou: python3 -m http.server 8080
```

Abra <http://localhost:8080>. Abrir os arquivos direto pelo `file://` também funciona.

## Publicação

O site oficial fica na hospedagem do domínio **drbrunokersten.com.br** (DirectAdmin), com o
painel administrativo em PHP. Veja [Painel administrativo e hospedagem](#painel-administrativo-e-hospedagem).

As cópias antigas foram desativadas para o Google não ver o site duplicado: o GitHub
Pages foi desligado nas configurações do repositório, e a Netlify redireciona tudo para o
domínio (`netlify.toml`).

Na hospedagem, o `.htaccess` da raiz (que vai no pacote) cuida de:

- endereço único: `http://` e `www.` redirecionam para `https://drbrunokersten.com.br`;
- página 404 do próprio site (`404.html`, com endereços a partir da raiz);
- `direitos.html`, página antiga, redireciona para `artigos.html`;
- o zip do pacote não pode ser baixado, mesmo se ficar na `public_html`;
- páginas `.html` com `Cache-Control: no-cache`: quem já visitou vê a versão nova logo
  depois de uma atualização.

O `sitemap.xml` é gerado pelo build e regravado pelo painel quando os artigos mudam; o
`robots.txt` aponta para ele.

---

## ⚠️ Antes de colocar no ar: dados a preencher

O documento de origem trazia campos em aberto, que foram mantidos **visíveis de propósito**
para não publicar informação inventada sobre um profissional de saúde. Procure por `[` no
projeto e substitua:

| Onde | O que preencher |
|---|---|
| `src/pages/sobre.html`, `src/pages/index.html` | `CRM/SP [a preencher com o registro oficial]` |
| `src/pages/sobre.html`, `src/pages/index.html` | `[inserir instituições/títulos]` da formação |
| `src/partials/footer.html`, `src/pages/contato.html`, `src/pages/index.html` | `[Endereço completo a inserir]` |
| `src/partials/header.html`, `src/partials/footer.html`, `src/pages/contato.html`, `src/pages/index.html` | telefone `(18) 0000-0000` |
| `src/partials/footer.html` | links de redes sociais (`href="#"`) |
| `src/pages/sobre.html`, `src/pages/index.html` | foto real no lugar da ilustração do retrato |

Também vale revisar, com o próprio médico, se a divulgação está de acordo com as normas do
Conselho Federal de Medicina sobre publicidade médica.

## Formulários

Os formulários de contato e de newsletter são **demonstrações**: exibem uma mensagem de
confirmação via JavaScript e não enviam nada. Para ativá-los, aponte o `action` do
formulário para um serviço de envio (Formspree, Basin, um endpoint próprio) ou trate o
`submit` em `assets/js/main.js` — a marcação `data-demo-form` é o gancho que hoje intercepta
o envio.

## Acessibilidade e desempenho

- Navegação por teclado com link "pular para o conteúdo" e foco visível.
- Carrossel com pausa ao passar o mouse/foco, setas do teclado, gesto de arrastar e respeito
  a `prefers-reduced-motion`.
- Menu mobile com `aria-expanded`, fechamento por `Esc` e por clique no fundo.
- Imagens são SVG inline ou arquivos leves; sem bibliotecas externas de JavaScript.
- Única requisição externa: as fontes do Google Fonts (Poppins e Open Sans). Se preferir um
  site 100% autocontido, hospede as fontes localmente e remova o `<link>` de `src/layout.html`.

## Painel administrativo e hospedagem

O painel fica em **`/admin/`** e é escrito em PHP, sem banco de dados. Ele edita
os dados de contato (telefone, WhatsApp, endereço, horário e redes) e troca as
duas fotos do médico (página inicial e página Sobre). Publica na hora: salvou, o
site já mostra.

### Como funciona

As páginas continuam sendo HTML estático. O pacote enviado à hospedagem traz as
páginas prontas e também cada página como **modelo**, com `{{TELEFONE}}` e afins
no lugar dos dados. O painel guarda os dados e regrava o HTML final na raiz do
site, aplicando os valores salvos nele.

Daí saem três garantias:

- **O site funciona assim que o zip é extraído**, mesmo numa `public_html`
  vazia: as páginas prontas vêm no pacote.
- **Um pacote novo não apaga o que foi salvo pelo painel**: os dados ficam na
  pasta de dados, fora do zip, e o painel volta a aplicá-los na primeira vez
  que é aberto depois do envio. Até lá, as páginas mostram os dados do
  repositório.
- **Se o PHP falhar, o site continua no ar**: as páginas já gravadas são HTML
  comum. Só o painel para.
- **O painel gera o mesmo HTML que o `build.js`**: a regra que aplica os dados
  existe nos dois (`TOKENS_SITE` no `build.js`, `tokensDoSite()` em
  `admin/inc/nucleo.php`). Mudou num, muda no outro.

Os dados, as senhas e as sessões ficam na pasta `painel-dados`, **ao lado** da
`public_html` — fora do alcance do navegador. Se a hospedagem não deixar criar
pasta ali, o painel usa `admin/dados`, protegida por `.htaccess`.

### Fotos

A foto enviada é cortada em retrato 3×4 (puxando o corte para cima, onde costuma
estar o rosto), reduzida para 880×1173 e regravada em JPEG. Regravar descarta o
que vinha escondido no arquivo, como a localização GPS que o celular anota. No
navegador, fotos grandes são reduzidas antes de subir, para não esbarrar no
limite de envio da hospedagem.

O original fica em `painel-dados/fotos` e é copiado para `public_html/fotos` a
cada publicação. Essa pasta não vem no pacote, então um pacote novo não volta a
foto antiga. O nome do arquivo leva um pedaço do hash: foto nova, endereço novo,
sem cache mostrando a anterior. Os endereços das fotos entram nas páginas pelos
tokens `{{FOTO_INICIO}}` e `{{FOTO_SOBRE}}`.

O painel precisa da extensão GD do PHP; sem ela, ele avisa e não troca a foto.

### Publicar uma versão nova

```bash
npm run pacote
```

Gera `pacote/site-drbrunokersten.zip`. Na hospedagem:

1. No gerenciador de arquivos do DirectAdmin, abra `domains/drbrunokersten.com.br/public_html`.
2. Envie o zip e use **Extrair** ali mesmo, sobrescrevendo o que existir.
3. Apague o zip.
4. **Abra `drbrunokersten.com.br/admin/` uma vez.** O site já funciona antes
   disso, mas é nesse momento que o painel reaplica o telefone, o WhatsApp e as
   fotos salvos nele.

### Primeiro acesso e senha esquecida

Não existe senha padrão. O primeiro acesso só pode ser criado por quem entra na
hospedagem:

1. Crie um arquivo vazio chamado `liberar-cadastro.txt` na pasta `painel-dados`
   (ao lado da `public_html`). A tela de criar acesso mostra o caminho exato.
2. Abra `/admin/criar-acesso.php` e escolha e-mail e senha.

O arquivo vale por 2 horas e é apagado assim que o acesso é criado. O mesmo
caminho serve para quem esqueceu a senha e não tem mais ninguém com acesso. Com
alguém dentro do painel, novos acessos e senhas novas se resolvem na parte
**Acessos**.

### Segurança

- Senhas com `password_hash`; nada guardado em texto.
- Todo formulário leva um token da sessão (CSRF).
- Depois de 5 tentativas erradas, o aparelho fica 15 minutos sem poder tentar. O
  IP é guardado como hash.
- Acesso removido cai na hora, mesmo para quem está com o painel aberto.
- "Manter conectado" desmarcado: a sessão termina ao fechar o navegador (e, de
  qualquer forma, em 12 horas).

### Testar na própria máquina

Com PHP instalado (o do XAMPP serve):

```bash
npm run pacote
# extraia o zip numa pasta de teste, por exemplo teste/public_html
php -S localhost:8090 -t teste/public_html
```

E abra <http://localhost:8090/admin/>. A pasta de dados será criada em
`teste/painel-dados`.

### Artigos

A página **Artigos** lista os textos publicados, e cada um ganha a própria
página (`artigo-<endereço>.html`). No painel há a lista com os artigos
publicados e os rascunhos, e um editor com título, resumo, data, texto, capa
opcional (16:9) e a opção "Publicar no site". O editor mostra ao lado uma
prévia de como o texto vai ficar.

O texto usa um formato simples, explicado no próprio editor:

| Escrevendo | Vira |
|---|---|
| linha em branco | novo parágrafo |
| `## Título` / `### Título` | subtítulo / subtítulo menor |
| `- item` | item de lista |
| `> texto` | quadro de destaque |
| `**palavra**` | negrito |

As regras estão em dois lugares que precisam gerar o mesmo HTML:
`src/artigos.js` (build) e `admin/inc/artigos.php` (painel). Os artigos
iniciais ficam em `src/data/artigos.json`; depois que o painel salva a
primeira lista, valem só os dele, guardados em `painel-dados/artigos.json`.

**Importar de PDF:** no editor, "Escolher PDF" lê o arquivo no próprio
navegador, com o [PDF.js](https://mozilla.github.io/pdf.js/) da Mozilla, e
preenche texto, título e resumo para revisão. O PDF não é enviado ao servidor.
O PDF.js vem do cdnjs, com versão fixa e conferido por assinatura (SRI); para
trocar de versão, atualize a URL e as duas assinaturas em `admin/painel.js`.
PDF digitalizado (só imagem) não tem texto para importar.

### O que não se edita pelo painel

O texto das páginas (`src/pages/*.html`) e os tipos de câncer
(`src/data/cancers.js`) continuam no código: muda-se no repositório, roda-se
`npm run pacote` e envia-se o zip.

## Assistente virtual

O botão **“Tire suas dúvidas”**, no canto de todas as páginas públicas, abre
uma conversa com um assistente de IA (Google Gemini). Ele responde em
linguagem simples sobre os assuntos do site e indica a página certa. Não faz
diagnóstico, não interpreta exames, não indica tratamento e não inventa dados
do consultório: nesses casos, encaminha para `contato.html`. Em emergência,
orienta ligar para o SAMU (192); em sofrimento emocional intenso, indica o
CVV (188 ou cvv.org.br).

### Como funciona

```
navegador (assets/js/assistente.js)
   │  POST JSON com as últimas 10 mensagens
   ▼
assistente/responder.php          ← só POST/JSON, mesma origem, limite de uso
   │  regras.md + conhecimento.md + dados do consultório + artigos publicados
   ▼
API do Google Gemini (generateContent), chamada pelo PHP com cURL
```

| Arquivo | Papel |
|---|---|
| `assets/js/assistente.js` | Botão, janela, histórico em `sessionStorage`, chamada `fetch` |
| `assistente/responder.php` | Endereço público que recebe as perguntas |
| `assistente/inc/assistente.php` | Validação, limite de uso, montagem do prompt, chamada à API |
| `assistente/inc/regras.md` | Prompt de sistema: papel, tom e o que o assistente nunca faz |
| `assistente/inc/conhecimento.md` | Base de conhecimento, **gerada pelo `build.js`** — não editar à mão |
| `src/conhecimento.js` | Regras que transformam as páginas em base de conhecimento |
| `painel-dados/assistente.php` | Chave e modelo (fica **na hospedagem**, fora do repositório e da `public_html`) |

A base de conhecimento sai do próprio texto do site: as páginas de
`src/pages/` e os 55 tipos de câncer de `src/data/cancers.js`. Mudou uma
página, o próximo `npm run build` atualiza a base. Os artigos publicados e os
dados de contato entram na hora, pelo PHP — e só os dados reais: telefone ou
endereço de exemplo (como `(18) 0000-0000`) não chegam à IA.

### Configurar a chave da API

A chave **nunca** vai para o JavaScript nem fica num arquivo que o navegador
consiga abrir. Ela fica num arquivo PHP na pasta de dados do painel, fora da
`public_html`.

1. **Crie a chave.** Entre em [aistudio.google.com](https://aistudio.google.com)
   com a conta Google do consultório, abra **Get API key** e crie uma chave.
   Copie o código.
2. **Veja onde fica a pasta de dados.** No painel (`/admin/`), o cartão
   **Assistente virtual** diz o caminho exato. Normalmente é
   `domains/drbrunokersten.com.br/painel-dados/`, ao lado da `public_html`.
3. **Crie o arquivo.** No DirectAdmin, abra **Gerenciador de Arquivos**, entre
   nessa pasta, clique em **Novo arquivo**, dê o nome `assistente.php` e cole:

   ```php
   <?php
   return [
       'chave'  => 'COLE_AQUI_A_SUA_CHAVE',
       'modelo' => 'gemini-3.5-flash-lite',
   ];
   ```

   Troque `COLE_AQUI_A_SUA_CHAVE` pela chave e salve. Em **Permissões**, deixe
   o arquivo em `600`.
4. **Confira.** No painel, o cartão deve mostrar **Ligado**. No site, faça uma
   pergunta pelo botão “Tire suas dúvidas”.

Enviar um pacote novo não apaga esse arquivo: ele não está no zip. Sem o
arquivo, o botão continua no site e responde que o assistente está
indisponível, indicando a página de contato.

Outras opções que o arquivo aceita (todas têm um valor padrão):

| Opção | Padrão | O que faz |
|---|---|---|
| `modelo` | `gemini-3.5-flash-lite` | Código do modelo do Gemini |
| `raciocinio` | `MINIMAL` | Nível de raciocínio (`MINIMAL`, `LOW`, `MEDIUM`, `HIGH`; `''` usa o do modelo). O `gemini-3.8-flash` e o Gemini 4 não aceitam `MINIMAL`: use `LOW` |
| `limite_por_ip` / `janela_minutos` | 20 / 10 | Mensagens por visitante a cada tantos minutos |
| `limite_diario` | 300 | Teto do site inteiro por dia (protege a conta da API); `0` = sem teto |
| `max_caracteres` | 800 | Tamanho máximo de cada pergunta |
| `historico` | 10 | Quantas mensagens da conversa vão para a IA |
| `tempo_limite` | 20 | Segundos esperando a API antes de desistir |

### Privacidade (LGPD)

- O conteúdo das conversas **não é gravado** no servidor. O histórico fica só
  na aba do navegador de quem conversa (`sessionStorage`) e some ao fechá-la.
- Para o limite de uso, o servidor guarda apenas o IP embaralhado (hash) e os
  horários das mensagens dos últimos minutos, em `painel-dados/assistente-uso.php`.
- A janela avisa que as mensagens vão para o Google Gemini e pede para não
  escrever dados pessoais. O assistente também não pede esses dados.
- **Plano gratuito × pago:** no plano gratuito do Gemini, o Google pode usar o
  conteúdo enviado para melhorar os produtos dele; no plano pago, não. Para uso
  real com pacientes, o recomendado é ativar o faturamento no AI Studio. Com o
  `gemini-3.5-flash-lite` (US$ 0,30 por milhão de tokens de entrada e US$ 2,50
  de saída, em novembro de 2026), cada pergunta sai por menos de US$ 0,01: o
  prompt tem uns 25 mil tokens. O `limite_diario` segura o gasto.

### Segurança

- Só aceita `POST` com JSON vindo de uma página do próprio site (cabeçalhos
  `Origin` e `Sec-Fetch-Site`): outro site não consegue usar o endereço como
  acesso grátis à IA.
- As respostas do assistente voltam assinadas (HMAC). Como o histórico fica no
  navegador, sem isso daria para inventar falas do “assistente” e mandá-las de
  volta — um jeito conhecido de tentar quebrar as regras de um modelo.
- A resposta da IA nunca entra na página como HTML: vira parágrafos, listas e
  texto. Só viram link as páginas do próprio site e o site do CVV.
- A chave vai à API no cabeçalho `x-goog-api-key`, não no endereço, e não
  aparece em nenhuma tela, nem no painel.

### Testar na própria máquina

O endpoint funciona com o servidor embutido do PHP (ver “Testar na própria
máquina”, acima). Para testar sem gastar a cota da API, a opção `servidor` do
`assistente.php` aceita um endereço `http://localhost:porta` — útil para uma
API simulada. Em produção, não use essa opção.

## Formulários de contato

Os formulários da página de contato e da home **não enviam e-mail**: montam a
mensagem e abrem a conversa no WhatsApp da clínica, já preenchida. A pessoa
revisa e envia pelo próprio aplicativo.

Foi a saída possível — e a mais honesta — para um site estático, que não tem
servidor para receber envios. O texto não passa por lugar nenhum além do
navegador de quem escreve.

Para funcionar, preencha o campo **WhatsApp** pelo painel (`/admin/`). No
repositório, o valor inicial fica em `src/data/site.json`, em formato
internacional; pode ter máscara — o build extrai só os dígitos:

```json
{ "whatsapp": "+55 (18) 99123-4567" }
```

Enquanto o campo estiver vazio, os formulários avisam que o WhatsApp não foi
configurado e preservam o que a pessoa digitou, em vez de fingir que enviaram.

O mesmo número alimenta o ícone de WhatsApp no rodapé.

**O cadastro da newsletter continua sendo demonstração** — é outro problema, que
exige um serviço de lista de e-mails.
