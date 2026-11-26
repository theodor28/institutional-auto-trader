#!/usr/bin/env python3
"""Piano Express SEO Autopilot: safe, explainable prioritization of GSC query exports.

This tool does not access Google, publish code, or change a website. It ingests
CSV exports supplied by the owner and produces a local SQLite history and
rank-opportunity report. All ranking scores are heuristics, not forecasts.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sqlite3
import sys
import unicodedata
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


SERVICE_PATTERNS = {
    "transporte": re.compile(r"transport|carreto|mudanca.*piano", re.I),
    "afinacao": re.compile(r"afin|afinador", re.I),
    "regulagem": re.compile(r"regul", re.I),
    "manutencao": re.compile(r"manutenc|revisao|conserv", re.I),
}
BRANDED_OR_TECHNICAL = re.compile(r"piano\s*express|site:|onrender\.com", re.I)


@dataclass(frozen=True)
class QueryMetric:
    query: str
    clicks: int
    impressions: int
    ctr: float
    position: float
    page: str = ""


@dataclass(frozen=True)
class Opportunity:
    query: str
    service_group: str
    clicks: int
    impressions: int
    ctr: float
    position: float
    page: str
    score: int
    priority: str
    suggested_action: str
    score_explanation: str


def normalize(value: str) -> str:
    raw = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(ch for ch in raw if not unicodedata.combining(ch)).lower().strip()


def _column(headers: list[str], aliases: tuple[str, ...], required: bool = True) -> int | None:
    normalized = [normalize(h) for h in headers]
    for i, value in enumerate(normalized):
        if any(value == normalize(alias) or normalize(alias) in value for alias in aliases):
            return i
    if required:
        raise ValueError(f"Coluna não encontrada. Esperado um destes nomes: {', '.join(aliases)}")
    return None


def _number(value: str | None, *, percent: bool = False) -> float:
    text = str(value or "").strip().replace("\u00a0", "").replace(" ", "")
    if not text:
        return 0.0
    if text.endswith("%"):
        text = text[:-1].replace(",", ".")
        return (float(text) / 100.0) if text else 0.0
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".") if text.rfind(",") > text.rfind(".") else text.replace(",", "")
    elif "," in text:
        text = text.replace(",", ".")
    result = float(text)
    if percent and result > 1:
        result /= 100.0
    return result


def load_gsc_csv(path: str | Path) -> list[QueryMetric]:
    file_path = Path(path)
    with file_path.open("r", encoding="utf-8-sig", newline="") as stream:
        sample = stream.read(4096)
        stream.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        reader = csv.reader(stream, dialect)
        rows = list(reader)
    if len(rows) < 2:
        raise ValueError("O CSV precisa conter cabeçalho e pelo menos uma linha.")
    headers = rows[0]
    query_i = _column(headers, ("top queries", "queries", "query", "consultas", "consulta"))
    clicks_i = _column(headers, ("clicks", "cliques"))
    impressions_i = _column(headers, ("impressions", "impressoes", "impressões"))
    ctr_i = _column(headers, ("ctr",), required=False)
    position_i = _column(headers, ("position", "posicao", "posição"))
    page_i = _column(headers, ("top pages", "page", "pagina", "página"), required=False)
    result: list[QueryMetric] = []
    for line_number, row in enumerate(rows[1:], start=2):
        if len(row) <= max(query_i, clicks_i, impressions_i, position_i):
            continue
        query = row[query_i].strip()
        if not query:
            continue
        ctr = _number(row[ctr_i] if ctr_i is not None and ctr_i < len(row) else "0", percent=True)
        result.append(QueryMetric(
            query=query,
            clicks=int(round(_number(row[clicks_i]))),
            impressions=int(round(_number(row[impressions_i]))),
            ctr=max(0.0, min(1.0, ctr)),
            position=_number(row[position_i]),
            page=row[page_i].strip() if page_i is not None and page_i < len(row) else "",
        ))
    if not result:
        raise ValueError("Nenhuma linha de consulta válida foi encontrada.")
    return result


def service_group(query: str) -> str:
    for group, pattern in SERVICE_PATTERNS.items():
        if pattern.search(normalize(query)):
            return group
    return "outro"


def _expected_ctr(position: float) -> float:
    # Conservative generic curve used only to flag possible snippet gaps.
    if position <= 1: return 0.28
    if position <= 2: return 0.15
    if position <= 3: return 0.10
    if position <= 4: return 0.07
    if position <= 5: return 0.05
    if position <= 10: return 0.035
    if position <= 20: return 0.015
    return 0.008


def score_opportunity(metric: QueryMetric, max_impressions: int) -> Opportunity:
    group = service_group(metric.query)
    demand = min(100.0, math.log1p(metric.impressions) / math.log1p(max(100, max_impressions)) * 100.0)
    if metric.position <= 3:
        proximity = 65.0
    elif metric.position <= 20:
        proximity = 100.0
    elif metric.position <= 30:
        proximity = 75.0
    elif metric.position <= 50:
        proximity = 55.0
    else:
        proximity = 30.0
    intent = 25.0 if group == "outro" else 100.0
    expected = _expected_ctr(metric.position)
    ctr_gap = max(0.0, min(100.0, (expected - metric.ctr) / max(expected, 0.01) * 100.0))
    page = normalize(metric.page)
    if not page:
        alignment = 60.0
    else:
        slug = {"transporte": "transport", "afinacao": "afin", "regulagem": "regul", "manutencao": "manutenc"}.get(group, "")
        alignment = 100.0 if slug and slug in page else 45.0
    score = round(demand * 0.30 + proximity * 0.25 + intent * 0.20 + ctr_gap * 0.15 + alignment * 0.10)
    if metric.position <= 3 and metric.ctr < expected * 0.5:
        action = "Testar título e descrição para melhorar o CTR, sem alterar a intenção da página."
    elif 4 <= metric.position <= 20:
        action = "Reforçar a página correspondente com informação original, prova de serviço e links internos úteis."
    elif metric.position > 20:
        action = "Conferir indexação, intenção e concorrentes antes de ampliar ou reescrever o conteúdo."
    else:
        action = "Acumular mais impressões antes de fazer uma alteração específica."
    priority = "alta" if score >= 70 else "média" if score >= 50 else "observar"
    explanation = (
        "Índice heurístico: 30% demanda relativa, 25% faixa de posição, "
        "20% intenção comercial, 15% lacuna estimada de CTR e 10% alinhamento da página. "
        "Não é uma previsão de posição nem usa benchmarks específicos da Piano Express."
    )
    return Opportunity(metric.query, group, metric.clicks, metric.impressions, metric.ctr,
                       metric.position, metric.page, score, priority, action, explanation)


def rank_opportunities(metrics: Iterable[QueryMetric]) -> list[Opportunity]:
    eligible = [m for m in metrics if m.query and not BRANDED_OR_TECHNICAL.search(m.query)]
    if not eligible:
        return []
    max_impressions = max(100, max(m.impressions for m in eligible))
    return sorted((score_opportunity(m, max_impressions) for m in eligible),
                  key=lambda item: (-item.score, -item.impressions, item.position))


def init_db(db_path: str | Path) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS snapshots(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          imported_at TEXT NOT NULL,
          source_file TEXT NOT NULL,
          row_count INTEGER NOT NULL
        )""")
        conn.execute("""
        CREATE TABLE IF NOT EXISTS metrics(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
          query TEXT NOT NULL, clicks INTEGER NOT NULL, impressions INTEGER NOT NULL,
          ctr REAL NOT NULL, position REAL NOT NULL, page TEXT NOT NULL
        )""")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_snapshot ON metrics(snapshot_id)")
        conn.commit()


def ingest(metrics: list[QueryMetric], source_file: str, db_path: str | Path) -> int:
    init_db(db_path)
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute(
            "INSERT INTO snapshots(imported_at, source_file, row_count) VALUES (?, ?, ?)",
            (datetime.now(timezone.utc).isoformat(), Path(source_file).name, len(metrics)),
        )
        snapshot_id = int(cursor.lastrowid)
        conn.executemany(
            "INSERT INTO metrics(snapshot_id,query,clicks,impressions,ctr,position,page) VALUES (?,?,?,?,?,?,?)",
            [(snapshot_id, m.query, m.clicks, m.impressions, m.ctr, m.position, m.page) for m in metrics],
        )
        conn.commit()
    return snapshot_id


def latest_metrics(db_path: str | Path) -> tuple[str, list[QueryMetric]]:
    init_db(db_path)
    with sqlite3.connect(db_path) as conn:
        row = conn.execute("SELECT id, imported_at FROM snapshots ORDER BY id DESC LIMIT 1").fetchone()
        if not row:
            return "", []
        data = conn.execute(
            "SELECT query,clicks,impressions,ctr,position,page FROM metrics WHERE snapshot_id=? ORDER BY id",
            (row[0],),
        ).fetchall()
    return row[1], [QueryMetric(*item) for item in data]


def create_report(metrics: list[QueryMetric]) -> dict:
    opportunities = rank_opportunities(metrics)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_rows": len(metrics),
        "eligible_queries": len(opportunities),
        "opportunities": [asdict(item) for item in opportunities],
        "guardrails": [
            "Dados são exportados pelo proprietário do Search Console; nenhuma autenticação ou senha é armazenada.",
            "O sistema não publica nem altera o site.",
            "Pontuações são heurísticas relativas; posição média do Search Console não equivale a uma posição fixa.",
            "Consultas de marca e consultas técnicas site:/onrender foram excluídas da priorização.",
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Prioriza oportunidades SEO da Piano Express com CSV do Search Console.")
    sub = parser.add_subparsers(dest="command", required=True)
    ingest_parser = sub.add_parser("ingest", help="Importa um CSV de consultas para o histórico SQLite.")
    ingest_parser.add_argument("csv_file")
    ingest_parser.add_argument("--db", default="piano_express_seo.sqlite3")
    report_parser = sub.add_parser("report", help="Gera um JSON com as oportunidades da última importação.")
    report_parser.add_argument("--db", default="piano_express_seo.sqlite3")
    report_parser.add_argument("--output", default="seo_opportunities.json")
    args = parser.parse_args(argv)
    try:
        if args.command == "ingest":
            metrics = load_gsc_csv(args.csv_file)
            snapshot_id = ingest(metrics, args.csv_file, args.db)
            print(f"Importação concluída: snapshot {snapshot_id}, {len(metrics)} consultas. Banco: {args.db}")
            print("Nenhuma alteração foi feita no site.")
        else:
            imported_at, metrics = latest_metrics(args.db)
            if not metrics:
                raise ValueError("Ainda não existe importação. Execute primeiro o comando ingest.")
            report = create_report(metrics)
            report["source_imported_at"] = imported_at
            Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Relatório salvo em {args.output}: {report['eligible_queries']} oportunidades.")
    except (OSError, ValueError, sqlite3.Error) as exc:
        print(f"Erro: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
