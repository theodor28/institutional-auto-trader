import csv
import tempfile
import unittest
from pathlib import Path

from seo_autopilot import QueryMetric, create_report, ingest, latest_metrics, load_gsc_csv, rank_opportunities


class SeoAutopilotTests(unittest.TestCase):
    def test_loads_portuguese_export_with_decimal_comma(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "gsc.csv"
            path.write_text(
                "Consultas;Cliques;Impressões;CTR;Posição\n"
                "afinação de piano em São Bernardo;2;100;2,0%;8,4\n"
                "transporte de piano;1;40;2,5%;17,2\n",
                encoding="utf-8",
            )
            rows = load_gsc_csv(path)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[0].impressions, 100)
            self.assertAlmostEqual(rows[0].ctr, 0.02)
            self.assertAlmostEqual(rows[0].position, 8.4)

    def test_excludes_brand_and_technical_queries(self):
        rows = [
            QueryMetric("Piano Express", 3, 20, .15, 2),
            QueryMetric("site:onrender.com", 0, 1, 0, 75),
            QueryMetric("transporte de piano no ABC", 1, 30, .03, 15),
        ]
        result = rank_opportunities(rows)
        self.assertEqual([item.query for item in result], ["transporte de piano no ABC"])

    def test_commercial_terms_rank_above_generic_query_at_same_metrics(self):
        commercial = QueryMetric("afinação de piano", 0, 100, 0, 12)
        generic = QueryMetric("informações sobre música", 0, 100, 0, 12)
        scored = {item.query: item.score for item in rank_opportunities([commercial, generic])}
        self.assertGreater(scored["afinação de piano"], scored["informações sobre música"])

    def test_database_keeps_each_import_as_a_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "seo.sqlite3"
            first = [QueryMetric("afinação de piano", 1, 20, .05, 8)]
            second = [QueryMetric("transporte de piano", 2, 50, .04, 11)]
            self.assertEqual(ingest(first, "first.csv", db), 1)
            self.assertEqual(ingest(second, "second.csv", db), 2)
            imported_at, latest = latest_metrics(db)
            self.assertTrue(imported_at)
            self.assertEqual(latest[0].query, "transporte de piano")

    def test_report_has_clear_guardrails(self):
        report = create_report([QueryMetric("regulagem de piano", 0, 22, 0, 19)])
        self.assertEqual(report["eligible_queries"], 1)
        self.assertTrue(any("não publica" in text for text in report["guardrails"]))


if __name__ == "__main__":
    unittest.main()
