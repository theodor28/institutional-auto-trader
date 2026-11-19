# CONEXA GPS — MVP público com limites explícitos

**Estado:** pronto para teste local; **não há publicação online confirmada**.

Aplicação web responsiva (Python 3.10+, JavaScript e Leaflet) para registrar viagens e encomendas voluntárias, visualizar regiões aproximadas no mapa, gerar candidatos de compatibilidade, enviar propostas e mensagens privadas.

## Funciona agora

- Cadastro com nome de usuário e senha (PBKDF2-HMAC-SHA256); sessão via cookie HttpOnly SameSite e token CSRF.
- Viagens com data, veículo, capacidade, desvio geométrico máximo; encomendas com peso, valor e prazo.
- Mapa interativo OSM, pontos de origem/destino arredondados a ~1 km, sem endereços completos.
- GPS **somente com permissão**, usando geolocalização do navegador no aparelho; a posição GPS **não é enviada ao servidor** neste MVP.
- Pré-filtro de candidatos por peso, tempo e progressão geométrica no percurso, sem prometer rotas reais, tempos nem lucro.
- Propostas, aceite/recusa, mensagens privadas entre as duas partes e denúncias.
- Sem anúncios falsos para inflar estatísticas; anúncios só aparecem após cadastro por usuário.
- Sem acesso à localização de terceiros, nem cobrança, pagamentos, autorizações automáticas ou rastreamento em segundo plano.

## Rodar localmente

```
cd conexa-gps
python app.py
```

Acesse `http://127.0.0.1:8000`. O SQLite é criado na pasta local. Para testar:

```
python -m unittest discover -s tests -v
node --check static/app.js
```

## Publicar com segurança no Render

É obrigatório um repositório Git e um **workspace Render escolhido pelo proprietário**. O `render.yaml` prepara web service e PostgreSQL, porém implantar Blueprint depende de revisar plano e aprovar a criação dos recursos.

**Atenção:** serviços web gratuitos Render têm sistema de arquivos efêmero. O aplicativo bloqueia o modo `APP_ENV=production` sem `DATABASE_URL` PostgreSQL. Bancos PostgreSQL gratuitos Render expiram após 30 dias, logo um produto público de longa duração requer banco persistente contratado ou serviço alternativo, cópia de segurança, auditoria de privacidade e gestão de custos. O `render.yaml` com banco free é apenas piloto temporário.

Em produção, o aplicativo exige `APP_ENV=production` e `DATABASE_URL` (PostgreSQL), define cookie Secure e usa `PORT` da plataforma. Para deploy com SQL PostgreSQL, instale `psycopg[binary]` via `requirements.txt`. O banco PostgreSQL **ainda precisa de teste de integração no Render real**.

## Limites que não devem ser ocultados

1. GPS ao vivo disponível enquanto a página aberta e após consentimento; não há rastreamento em segundo plano.
2. Não há serviço de rotas rodoviárias integrado. O filtro utiliza **limite inferior geométrico** e **não garante** menos minutos, distância de estrada ou desvio real. A interface permite abrir Google Maps para conferir o trajeto.
3. Contas sem verificação de identidade ou telefone: transações devem ser confirmadas pelas partes; nunca pagar antecipado.
4. Ainda não há moderação operacional, termos jurídicos completos, suporte de incidente, cobrança, notificações push, antivandalismo em escala nem meios de pagamento.
5. O projeto não deve ser anunciado como produto comercial homologado nem como provedor de entregas garantidas.
6. A suíte de testes não é auditoria independente de segurança. O piloto deve ter revisão de LGPD, política de retenção e equipe de moderação antes de escalar.

## Próxima fase Extra High

1. Ativar PostgreSQL durável com backup testado; medir tempos de resposta, disponibilidade e custos.
2. Integrar roteamento rodoviário licenciado/autohospedado; testar desvios e tempo real contra viagens feitas.
3. Adicionar verificação de identidade/telefone opcional com provedor confiável, painel de moderação e notificações.
4. Rodar piloto fechado com usuários que consentiram e publicar métricas verdadeiras (zero fictícias).
5. Monitorar taxa de combinações úteis, redução de quilômetros, cancelamentos, abusos e falhas; somente então abrir escala pública.

## Licenças / serviços externos

- Leaflet 1.9.4 via unpkg CDN; mapa OpenStreetMap com atribuição © OpenStreetMap contributors. Antes de uso em grande escala, usar provedor de tiles com contrato adequado e política de privacidade.
- O aplicativo **não utiliza** o servidor público de demonstração do OSRM, inadequado para uso comercial em escala.

## Estrutura

- `app.py`: API HTTP, autenticação, banco, validação, filtragem de viagens, propostas.
- `static/`: interface responsiva HTML, CSS e JavaScript.
- `tests/`: testes de API e segurança funcional com serviço real em loopback.
- `render.yaml`: proposta de infraestrutura a revisar, não deploy automático.
