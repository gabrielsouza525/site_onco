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
├── noticias.html
├── artigo-campanhas.html
├── artigo-tratamentos.html
├── artigo-psico-oncologia.html
├── contato.html
├── busca.html
├── 404.html
│
├── build.js                      ← gerador (Node, sem dependências)
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

Qualquer hospedagem estática serve. No GitHub Pages, basta apontar para a raiz da branch —
as páginas já estão versionadas. O arquivo `404.html` é reconhecido automaticamente.

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

## Editar o site sem mexer em código

O painel fica em `/admin/` e usa o [Decap CMS](https://decapcms.org). Ele grava
direto nos arquivos de `src/` e faz um commit; o workflow
`.github/workflows/build.yml` roda o `build.js`, regenera o HTML e o GitHub
Pages republica. Nenhum passo manual.

### O que já dá para editar

**Contato e redes** (`src/data/site.json`) — telefone, endereço, cidade,
horário e os perfis sociais. Esses valores entram em todas as páginas de uma
vez, via tokens `{{TELEFONE}}`, `{{ENDERECO}}`, `{{HORARIO}}` e afins,
resolvidos no build. Uma rede deixada em branco vira `#`.

### O que ainda não dá

O texto das páginas mora em `src/pages/*.html` e os tipos de câncer em
`src/data/cancers.js`. O Decap só edita YAML, JSON, TOML ou markdown com
front-matter — HTML cru e módulo JavaScript não entram. Para abrir esse
conteúdo ao painel seria preciso convertê-lo para markdown e ensinar o
`build.js` a renderizá-lo.

### Autenticação — o que falta para publicar

O backend `github` precisa de um servidor de OAuth para trocar o código de
login por um token de acesso, e o **GitHub Pages não tem servidor**. Enquanto
isso não for resolvido, o painel funciona **apenas na máquina de quem edita**:

```bash
npx decap-server      # em um terminal
npm start             # em outro
```

Depois abra <http://localhost:8080/admin/>.

Para o painel funcionar no site publicado, há dois caminhos:

1. **Publicar o site na Netlify ou na Cloudflare Pages** em vez do GitHub
   Pages. As duas oferecem autenticação e funções de servidor no plano
   gratuito, e o Decap passa a funcionar direto. Como o site é estático, a
   migração é simples.
2. **Manter o GitHub Pages e subir um proxy de OAuth** próprio (uma função na
   Cloudflare ou na Vercel), apontando `base_url` no `admin/config.yml` para
   ele. Evite proxies públicos de terceiros: eles recebem permissão de escrita
   no repositório.

## Formulários de contato

Os formulários da página de contato e da home **não enviam e-mail**: montam a
mensagem e abrem a conversa no WhatsApp da clínica, já preenchida. A pessoa
revisa e envia pelo próprio aplicativo.

Foi a saída possível — e a mais honesta — para um site estático, que não tem
servidor para receber envios. O texto não passa por lugar nenhum além do
navegador de quem escreve.

Para funcionar, preencha o campo **WhatsApp** em `src/data/site.json` (ou pelo
painel, em *Contato e redes*) com o número em formato internacional. Pode
digitar com máscara — o build extrai só os dígitos:

```json
{ "whatsapp": "+55 (18) 99123-4567" }
```

Enquanto o campo estiver vazio, os formulários avisam que o WhatsApp não foi
configurado e preservam o que a pessoa digitou, em vez de fingir que enviaram.

O mesmo número alimenta o ícone de WhatsApp no rodapé.

**O cadastro da newsletter continua sendo demonstração** — é outro problema, que
exige um serviço de lista de e-mails.
