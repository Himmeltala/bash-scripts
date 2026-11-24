"""模型与项目筛选：查询参数解析，以及按记录收窄的口径。"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(REPO / "lib" / "py-shared" / "services"))
sys.path.insert(0, str(REPO / "llmx" / "src"))

from llmx import cli, report
from llmx import web as llmx_web
from llmx.model import Record
from llmx.pricing import PriceBook

BOOK = PriceBook(aliases={"old-model": "new-model"})


def record(model, project):
    return Record(
        source="claude",
        session="s",
        at=datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc),
        model=model,
        project=project,
    )


class QueryArgsTest(unittest.TestCase):
    def test_model_and_project_are_split_on_commas(self):
        args, _, _ = llmx_web._args(
            None,
            {
                "command": ["daily"],
                "since": ["2026-11-01"],
                "until": ["2026-11-20"],
                "model": ["a,b"],
                "project": ["p1,p2"],
            },
        )
        self.assertEqual(args.model, ["a", "b"])
        self.assertEqual(args.project, ["p1", "p2"])

    def test_missing_filters_stay_off_the_namespace(self):
        args, _, _ = llmx_web._args(
            None,
            {"command": ["daily"], "since": ["2026-11-01"], "until": ["2026-11-20"]},
        )
        self.assertFalse(hasattr(args, "model"))
        self.assertFalse(hasattr(args, "project"))


class NarrowRecordsTest(unittest.TestCase):
    def setUp(self):
        self.records = [record("old-model", "p1"), record("other", "p2")]
        self.names = {
            item.model: report._model_name(item, BOOK) for item in self.records
        }

    def test_alias_resolves_to_display_name(self):
        self.assertEqual(self.names["old-model"], "new-model")

    def test_no_filters_keeps_every_record(self):
        self.assertEqual(
            cli._narrow_records(self.records, None, None, self.names), self.records
        )

    def test_model_filter_uses_display_name(self):
        kept = cli._narrow_records(self.records, ["new-model"], None, self.names)
        self.assertEqual([item.model for item in kept], ["old-model"])

    def test_project_filter_matches_exactly(self):
        kept = cli._narrow_records(self.records, None, ["p2"], self.names)
        self.assertEqual([item.project for item in kept], ["p2"])


if __name__ == "__main__":
    unittest.main()
