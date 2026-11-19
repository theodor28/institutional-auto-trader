# CONEXA GPS — Auditoria Extra High, 19/11/2026

Método: **Extra High + Maximum Rigor Engineering + Adversarial Testing + Recursive Optimization**.

## Escopo e evidências

- Testes HTTP locais em loopback, com banco SQLite temporário e contas de teste. Nenhum usuário real foi criado.
- 13/13 testes automatizados (8 testes originais + 5 adversariais) passaram após as correções.
- Teste adicional de 40 cadastros concorrentes: **8 respostas HTTP 200**, **32 respostas HTTP 429**. Comprovou o bloqueio atômico de cadastros acima do limite de 8/h nessa única instância.
- 20.000 encomendas **sintéticas** comparadas com uma viagem fictícia em ~0,04 segundo; 1.044 foram candidatas ao pré-filtro geométrico. **Não são entregas, usuários, demanda ou receitas reais**.
- 200 requisições HTTP concorrentes `GET /api/health` com 12 trabalhadores: 200/200 HTTP 200; latência local mediana 12,9 ms, p95 18,9 ms, máximo 1.023 ms. **Não é prova de carga de produção**, rede pública ou infraestrutura Render.
- Teste visual automatizado com Chromium instalado: **não executado**, porque a política do navegador bloqueou inclusive navegação para `http://127.0.0.1` (`ERR_BLOCKED_BY_ADMINISTRATOR`).
- O código foi publicado em branch exclusiva: `conexa-gps-publico-20261119` no repositório `theodor28/institutional-auto-trader`.

## Ciclos de correção aplicados

1. **Privacidade:** bloqueio de e-mail, telefone e formato comum de CPF em campos de anúncio público; conversas seguem privadas entre participantes. Expressões regulares não substituem revisão de privacidade.
2. **GPS opt-in:** desligar GPS limpa posição em memória e marcador local, além de interromper o observador de posição.
3. **Concorrência:** propostas duplicadas simultâneas recebem HTTP 409, não erro 500; limites de cadastros/login são consumidos com atualização atômica.
4. **HTTP defensivo:** limite de espera para conexão, rejeição de transfer-encoding não implementado e cabeçalho HSTS em produção.
5. **Regressão:** após cada mudança, execução da suíte de testes originais e adversariais e validação de sintaxe JavaScript.

## Portões NÃO ultrapassados

- **Hospedagem pública:** Render recusou o novo serviço por limite do workspace (24 serviços + 1 banco novo). Nenhum site existente foi removido/modificado para abrir vaga.
- **PostgreSQL:** criado serviço gratuito, mas não houve teste de integração real da aplicação com o banco; o plano gratuito expira em 19/12/2026.
- **Navegação viária:** o motor só oferece um pré-filtro geométrico com limite inferior; não mede desvios pelas ruas nem tempos de viagem reais.
- **Operação comercial:** sem identidade verificada, moderação ativa, suporte, política completa de proteção/remoção dos dados, cobertura de seguro, garantias ou pagamentos. Não lançar sem revisão.
- **GPS:** disponível somente após autorização e com a página aberta; não se trata de GPS nativo ou rastreamento em segundo plano.
- **Teste visual no navegador:** bloqueado por política de execução do ambiente.

## Próxima ação verificável

Conectar hospedagem persistente alternativa (por exemplo, Railway) ou liberar cota do Render **sem apagar serviços existentes sem autorização**. Executar integração real com PostgreSQL, teste visual em navegador, roteamento rodoviário e piloto consentido com pessoas verificadas. Publicação fica **NÃO COMPROVADA** até um endereço HTTPS público responder `GET /api/health` com PostgreSQL durável e testes de jornada real.