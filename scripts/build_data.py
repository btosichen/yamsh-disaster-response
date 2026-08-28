"""Generate the static web app data file from the official workbook.

Usage:
  python scripts/build_data.py path/to/workbook.xlsx
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import openpyxl


MAIN_SHEET = "應變小組主表"
ANNEXES = {
    "附表一_高中專任": {
        "group": "搶救組", "fire_group": "滅火班", "name_index": 1, "title_index": 2
    },
    "附表二_國高中導師": {
        "group": "避難引導組", "fire_group": "避難引導班", "name_index": 2, "title_index": 1
    },
    "附表三_國中專任": {
        "group": "安全防護組", "fire_group": "安全防護班", "name_index": 1, "title_index": 2
    },
}
PLACEHOLDER_NAMES = {"高中專任（含外師）", "國高中導師", "國中專任"}
MANUAL_RECORDS = [
    {
        "name": "張安莛",
        "title": "秘書",
        "group": "緊急救護組",
        "fireGroup": "救護班",
        "role": "組長",
        "detail": (
            "設立急救站。\n"
            "針對傷患進行檢傷分類。\n"
            "緊急基本急救、重傷患就醫護送。\n"
            "情緒支持、安撫及心理輔導。\n"
            "登記傷患姓名、班級，建立傷患名冊。"
        ),
        "source": "補充資料",
    }
]


def text(value: object, fallback: str = "-") -> str:
    value = str(value or "").strip()
    return value or fallback


def normalize_role(value: object) -> str:
    role = text(value, "組員")
    if "組長" in role:
        return "組長"
    if "組員" in role:
        return "組員"
    return role


def keep_first_assignment_per_person(
    records: list[dict[str, str]],
) -> list[dict[str, str]]:
    """Keep one assignment per person, preserving source and row priority.

    Main-sheet rows are read before annex rows, so an explicit main-sheet
    assignment takes precedence over a generic annex assignment. If a person
    appears more than once in the same source sequence, the first row wins.
    """
    output: list[dict[str, str]] = []
    seen_names: set[str] = set()
    for record in records:
        name = record["name"]
        if name in seen_names:
            continue
        seen_names.add(name)
        output.append(record)
    return output


def read_records(path: Path) -> list[dict[str, str]]:
    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    records: list[dict[str, str]] = []

    main = workbook[MAIN_SHEET]
    for row in main.iter_rows(min_row=3, max_col=7, values_only=True):
        _, group, fire_group, role, name, title, detail = row
        name = text(name, "")
        if not name or name in PLACEHOLDER_NAMES:
            continue
        records.append(
            {
                "name": name,
                "title": text(title),
                "group": text(group),
                "fireGroup": text(fire_group),
                "role": text(role),
                "detail": text(detail),
                "source": MAIN_SHEET,
            }
        )

    for sheet_name, config in ANNEXES.items():
        sheet = workbook[sheet_name]
        for row in sheet.iter_rows(min_row=4, max_col=5, values_only=True):
            name = row[config["name_index"]]
            title = row[config["title_index"]]
            assignment = row[3]
            detail = row[4]
            name = text(name, "")
            if not name:
                continue
            records.append(
                {
                    "name": name,
                    "title": text(title),
                    "group": config["group"],
                    "fireGroup": config["fire_group"],
                    "role": normalize_role(assignment),
                    "detail": text(detail),
                    "source": sheet_name,
                }
            )

    existing_keys = {
        (record["name"], record["group"], record["fireGroup"], record["role"])
        for record in records
    }
    for record in MANUAL_RECORDS:
        key = (record["name"], record["group"], record["fireGroup"], record["role"])
        if key not in existing_keys:
            records.append(record.copy())

    return keep_first_assignment_per_person(records)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("請提供 Excel 檔案路徑。")

    source = Path(sys.argv[1]).resolve()
    if not source.exists():
        raise SystemExit(f"找不到檔案：{source}")

    records = read_records(source)
    names = {record["name"] for record in records}
    output = Path(__file__).resolve().parents[1] / "staff-data.js"
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    output.write_text(
        "// 由 scripts/build_data.py 從正式 Excel 名冊產生，請勿手動編輯。\n"
        f"window.STAFF_DATA = {payload};\n",
        encoding="utf-8",
    )
    print(f"已產生 {output}：{len(records)} 筆任務、{len(names)} 位人員。")


if __name__ == "__main__":
    main()
