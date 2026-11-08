# EveShoppin — Marketplace demonstrativo online

**Online:** https://eveshoppin-marketplace.onrender.com/
**Local Windows:** http://127.0.0.1:5260/ (executar ABRIR_EVESHOPPIN.py)
**Repositório:** https://github.com/theodor28/institutional-auto-trader/tree/eveshoppin-marketplace-v1/eveshoppin

## Funcionalidades implementadas
- Catálogo de 32 produtos **fictícios/ilustrativos** e 9 categorias;
- Pesquisa, filtro por categoria e ordenação;
- Carrinho com quantidades, estoque e totais calculados pelo servidor;
- Cupom demonstrativo EVE10 (10% até R$ 30, mínimo R$ 70), frete fictício de R$ 19,90 ou grátis a partir de R$ 199,90 após desconto;
- Cadastro/login de comprador e vendedor, sessões por cookie, senha protegida por PBKDF2;
- Favoritos, histórico de pedidos, avaliações por comprador que fez pedido no teste;
- Área de vendedor: cadastro de produtos, estoque e pedidos simulados contendo seus produtos;
- Checkout simulado (Pix/boleto/cartão de exemplo), dedução de estoque e geração de pedido sem cobrança ou entrega;
- Fotos ilustrativas de Unsplash. Não são imagens exatas dos itens;
- Interface responsiva para desktop e smartphone, com marca própria.

## Como testar
1. Abra o site na internet e experimente a busca, filtros e carrinho sem login.
2. Crie conta **Quero comprar** e finalize um pedido de teste (não haverá pagamento ou entrega).
3. Para cadastrar produtos, crie uma conta separada com perfil **Quero vender**.
4. Publique um produto ilustrativo e ajuste estoque na área do vendedor.
5. Acesse seus pedidos de demonstração e favoritos.

## Testes
30/30 testes de integração HTTP passaram no Windows em 08/11/2026: catálogo, filtros, login, estoque, cupom, checkout fictício, favoritos, anúncios de vendedor, painel de vendas, avaliações e logout.

## Limites importantes
- **Não é uma operação de comércio real.** Não processa pagamentos nem fretes reais e não possui antifraude, meios de logística, fiscalidade, chargeback, reembolso, KYC ou mediação de disputa.
- Lojas, notas iniciais, popularidade, preços, produtos e cupons são dados de demonstração.
- A versão hospedada gratuitamente no Render usa um banco SQLite **efêmero** em /tmp: usuários, anúncios e pedidos podem desaparecer quando a instância for reiniciada; não informe dados pessoais reais.
- Para produção: banco persistente gerenciado, domínio e e-mail transacional, LGPD, logs, testes de segurança, pagamentos habilitados pelo proprietário, logística, termos de uso, regras de vendedores, suporte e monitoramento.
- A aplicação é **inspirada em funcionalidades comuns de marketplaces**, mas sua identidade visual e nome são próprios; não é afiliada à Shopee.

## Arquivos
- server.py — servidor/API Python e SQLite;
- index.html — vitrine e painéis responsivos;
- teste_eveshoppin.py — testes isolados;
- ABRIR_EVESHOPPIN.py — inicia o app e abre no browser local.

## Tecnologias
Python standard library, SQLite, HTML/CSS/JavaScript, GitHub e Render Free. Sem dependências pip.
