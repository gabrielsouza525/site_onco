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
├── direitos.html
├── tipos-de-cancer.html          ← + uma página por tipo (cancer-*.html)
├── contato.html
├── busca.html
├── 404.html
│
├── build.js                      ← gerador (Node, sem dependências)
├── scripts/pacote.js             ← monta o zip para a hospedagem
├── admin/                        ← painel administrativo (PHP)
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

A cópia no GitHub Pages continua funcionando como vitrine do repositório, mas sem painel:
lá o PHP não roda.

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
