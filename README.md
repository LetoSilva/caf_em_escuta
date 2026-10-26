# CAF ° — Pesquisa de Satisfação do Fornecedor | AXIA Energia

Aplicação estática em HTML/CSS/JavaScript para publicar no GitHub Pages, com respostas armazenadas no Supabase e atualização do dashboard em tempo real.

## O que está incluído

- Pesquisa anônima com quatro perguntas: atendimento, qualidade/prazos, comentário livre opcional e satisfação geral.
- Dashboard público com volume de respostas, satisfação média, percentual de satisfeitos, respostas do dia, tendência diária e notas recentes.
- Interface responsiva, identidade azul-marinho/azul elétrico/ciano/branco.
- Proteção de banco: o navegador pode inserir respostas, mas não consultar diretamente a tabela.
- Funções RPC expõem apenas indicadores e notas. O texto livre não aparece no dashboard público.
- Filtro de 7, 30, 90 dias ou todo o período.

## Arquivos

- `index.html` — estrutura da aplicação.
- `style.css` — estilos e responsividade.
- `app.js` — envio, dashboard e realtime.
- `config.js.example` — modelo de configuração; copie para `config.js`.
- `supabase.sql` — tabela, RLS, permissões e funções do dashboard.

## 1. Criar o projeto Supabase

1. Entre em https://supabase.com/ e crie um projeto.
2. Guarde a senha do banco em local seguro.
3. Abra **SQL Editor → New query**.
4. Copie todo o conteúdo de `supabase.sql`, cole no editor e clique em **Run**.
5. Em **Project Settings → API** (ou **Connect**, conforme a versão do painel), copie:
   - **Project URL**
   - **Publishable key** ou a chave pública `anon`.
6. Nunca use `service_role`, secret key ou senha do banco no navegador.

## 2. Configurar o frontend

1. Faça uma cópia de `config.js.example` com o nome exato `config.js`.
2. Edite `config.js` e substitua os dois valores de exemplo pela URL e chave pública do seu projeto.
3. Mantenha `config.js` na mesma pasta de `index.html`.
4. O `config.js` real não está incluído no pacote porque contém a URL/chave específica do seu projeto.

Exemplo:

```js
window.CAF_CONFIG = {
  SUPABASE_URL: "https://seu-projeto.supabase.co",
  SUPABASE_ANON_KEY: "sua-chave-publicavel"
};
```

A chave pública pode ser exposta no frontend quando a segurança é aplicada por RLS e permissões mínimas. Isso não vale para a chave `service_role`.

## 3. Publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `CAF-axia`.
2. Envie `index.html`, `style.css`, `app.js` e o `config.js` preenchido para a raiz do repositório.
3. Envie também `supabase.sql` e `README.md` para documentação.
4. No repositório, abra **Settings → Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Selecione a branch `main` e a pasta `/(root)`, depois clique em **Save**.
7. Aguarde o GitHub publicar e abra a URL exibida na página de Pages.
8. Teste envio pelo formulário e confirme se os KPIs mudam no dashboard.

> O GitHub Pages é estático. O Supabase é o serviço que armazena as respostas e permite sincronização entre dispositivos.

## 4. Teste recomendado

- Envie uma resposta de teste.
- Abra o dashboard em outra aba/dispositivo e veja se os indicadores atualizam.
- Teste os filtros de período.
- Confira no Supabase → Table Editor que a linha foi criada.
- Verifique que o texto de comentário não é retornado no dashboard público.
- Remova respostas de teste antes do lançamento, se for apropriado.

## Privacidade e segurança — leia antes de divulgar

- A pesquisa não pede nome, empresa ou e-mail. Mesmo assim, evite solicitar informações pessoais no comentário.
- O dashboard é público e não exige login: qualquer pessoa com o link poderá ver os indicadores e as notas recentes (não os comentários).
- A chave pública não é uma senha. A segurança depende das políticas RLS e das permissões do banco.
- O formulário público pode receber spam. Para produção corporativa, considere rate limiting/anti-bot e aprovação das áreas de Segurança, Privacidade/LGPD e Comunicação da AXIA Energia.
- O sistema não comprova a identidade de quem responde e não limita automaticamente respostas repetidas.
- Confirme com a governança da empresa se o uso de GitHub Pages e Supabase externos está autorizado antes de publicar dados corporativos.

## Solução de problemas

**“Configure o Supabase”** — confira se `config.js` existe na raiz e se os nomes das propriedades estão corretos.

**Erro ao enviar** — execute `supabase.sql` no projeto certo; confirme a URL/chave pública e as políticas RLS.

**Dashboard não carrega** — confirme se as três funções RPC foram criadas e se receberam permissão `EXECUTE`.

**Não atualiza em tempo real** — no Supabase, confira Database → Replication/Realtime e se `CAF_respostas` está na publicação `supabase_realtime`. O botão Atualizar também recarrega os indicadores.

**A URL não abre** — confirme Settings → Pages, branch `main`, pasta raiz e aguarde a implantação.

## Observação

Este é um pacote inicial funcional, que precisa ser configurado com as credenciais do projeto Supabase e validado pela empresa antes de uso oficial. A identidade visual é inspirada na paleta azul-marinho/ciano solicitada; use os ativos oficiais da marca AXIA somente conforme as regras internas da empresa.
