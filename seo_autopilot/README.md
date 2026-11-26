# STEINER SEO AUTOPILOT — Piano Express

Motor local e auditável para priorizar oportunidades orgânicas a partir de dados reais do Google Search Console.

## O que esta versão faz

- Importa exportações CSV do relatório **Desempenho → Resultados da pesquisa → Consultas**.
- Normaliza cabeçalhos em português e inglês.
- Mantém snapshots históricos em SQLite para comparação entre importações.
- Filtra consultas de marca e consultas técnicas `site:`/`onrender.com`.
- Classifica consultas por serviço (transporte, afinação, regulagem, manutenção).
- Calcula um índice heurístico explicável e sugere a próxima ação.
- Gera JSON local para alimentar o painel e outros relatórios.

## O que não faz

- Não conecta diretamente à conta Google nem guarda tokens OAuth.
- Não raspa resultados do Google e não finge posição de ranking.
- Não cria links, avaliações, cliques ou tráfego artificiais.
- Não publica nem modifica o site. Alterações futuras devem passar por branch, testes, revisão e aprovação.

## Uso

Requer Python 3.10+ e usa apenas a biblioteca padrão.

```bash
python seo_autopilot.py ingest export-consultas.csv
python seo_autopilot.py report
```

Para usar outro banco ou arquivo de saída:

```bash
python seo_autopilot.py ingest export-consultas.csv --db dados/piano_express.sqlite3
python seo_autopilot.py report --db dados/piano_express.sqlite3 --output dados/oportunidades.json
```

## Painel web

Após publicação do site, o painel operacional (marcado como `noindex,nofollow`) fica em. O endereço não tem autenticação; qualquer pessoa com o link pode abrir, embora os dados importados sejam processados localmente no navegador:

`/monitor/`

Ele aceita o CSV exportado do Search Console diretamente no navegador. O arquivo não é enviado ao servidor e os dados permanecem somente na aba atual. Não abra o painel em computador compartilhado.

## Critérios da pontuação

- 30% demanda relativa observada (impressões).
- 25% faixa da posição média (4–20 recebe maior prioridade de otimização).
- 20% intenção comercial aproximada pelo grupo de serviço.
- 15% lacuna de CTR frente a uma curva genérica conservadora.
- 10% alinhamento da página com o serviço.

O resultado é uma regra de triagem, não uma estimativa de posição futura. A posição do Search Console é uma média afetada por localização, dispositivo, consulta e período.

## Rotina operacional recomendada

1. Exportar consultas do Search Console semanalmente, usando período comparável.
2. Importar CSV e gerar oportunidades.
3. Verificar manualmente indexação e concorrentes para as 3 maiores oportunidades.
4. Propor uma alteração pequena em branch separada.
5. Executar testes técnicos e de conteúdo; guardar evidências e rollback.
6. Publicar somente após aprovação.
7. Medir novamente após 14, 28 e 56 dias.

## Testes

```bash
python -m unittest discover -s seo_autopilot -v
```
