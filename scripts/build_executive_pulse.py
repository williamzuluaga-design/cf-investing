#!/usr/bin/env python3
"""Build the three-signal CF Pulse from reviewed inputs and Project Intelligence.

This is deliberately semi-automatic. Market facts and scheduled external events
remain human-reviewed inputs; the script selects the latest source-reviewed
capital case, drops past events, enforces a maximum of three executive signals,
and flags stale reviewed inputs for human attention.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUTS = ROOT / "public/data/pulse-inputs.json"
PROJECTS = ROOT / "public/data/projects.json"
OUTPUT = ROOT / "public/data/executive-pulse.json"

INSTRUMENT_ES = {
    "Loan": "Préstamo",
    "Credit Line": "Línea de crédito",
    "Green Bond": "Bono verde",
    "Development Credit": "Crédito de desarrollo",
}


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_day(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def fmt_day_en(value: str) -> str:
    d = parse_day(value)
    return f"{d.day} {d.strftime('%b %Y')}"


def fmt_day_es(value: str) -> str:
    d = parse_day(value)
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{d.day} {months[d.month - 1]} {d.year}"


def amount_is_disclosed(value: str) -> bool:
    low = (value or "").strip().lower()
    return bool(low) and not low.startswith("not ") and "not disclosed" not in low and "not stated" not in low


def choose_capital_project(projects: list[dict], fallback_id: str | None) -> dict:
    candidates = []
    for project in projects:
        status = project.get("evidence_status", [])
        if "Source Reviewed" not in status:
            continue
        if not amount_is_disclosed(project.get("amount_display", "")):
            continue
        if not project.get("source_date"):
            continue
        candidates.append(project)
    if candidates:
        return max(candidates, key=lambda p: parse_day(p["source_date"]))
    for project in projects:
        if project.get("id") == fallback_id:
            return project
    raise RuntimeError("No suitable source-reviewed capital project is available")


def market_signal(markets: dict, stale: bool) -> dict:
    source_status = markets.get("source_status", "Primary sources")
    if stale:
        source_status = f"Review required · {source_status}"
    return {
        "id": "markets-reviewed-signal",
        "type": "markets",
        "label_en": markets["label_en"],
        "label_es": markets["label_es"],
        "headline_en": markets["headline_en"],
        "headline_es": markets["headline_es"],
        "metric_en": markets["metric_en"],
        "metric_es": markets["metric_es"],
        "why_en": markets["why_en"],
        "why_es": markets["why_es"],
        "source_status": source_status,
        "sources": markets.get("sources", []),
    }


def capital_signal(project: dict) -> dict:
    instrument_en = project.get("instrument", "Financing")
    instrument_es = INSTRUMENT_ES.get(instrument_en, "Financiación")
    amount = project.get("amount_display", "Amount disclosed")
    sponsor = project.get("sponsor_or_borrower", "")
    sector = project.get("sector", "the documented use")
    source_date = project.get("source_date", "")
    return {
        "id": f"capital-{project['id']}",
        "type": "capital",
        "label_en": "Capital signal",
        "label_es": "Señal de capital",
        "headline_en": f"{amount} {instrument_en.lower()} signal",
        "headline_es": f"{instrument_es} por {amount}",
        "metric_en": f"{sponsor} · {fmt_day_en(source_date)}" if source_date else sponsor,
        "metric_es": f"{sponsor} · {fmt_day_es(source_date)}" if source_date else sponsor,
        "why_en": f"The latest source-reviewed case with a disclosed amount shows institutional capital moving through {instrument_en.lower()} toward {sector.lower()}.",
        "why_es": f"El caso más reciente revisado en fuente con monto divulgado muestra capital institucional canalizado mediante {instrument_es.lower()} hacia una necesidad documentada de financiación.",
        "source_status": "Public Source · Source Reviewed",
        "sources": [
            {
                "name": "CF Investing project profile",
                "url_en": project.get("profile_url", "/projects/"),
                "url_es": project.get("profile_url_es", "/es/proyectos/"),
            }
        ],
    }


def event_signal(events: list[dict], projects_by_id: dict[str, dict], today: date) -> tuple[dict, date | None]:
    upcoming = []
    for event in events:
        start = parse_day(event["date"])
        end = parse_day(event.get("date_end", event["date"]))
        if end >= today:
            upcoming.append((start, event))
    upcoming.sort(key=lambda item: item[0])
    selected = upcoming[:3]

    if not selected:
        return {
            "id": "events-review-required",
            "type": "events",
            "label_en": "Events radar",
            "label_es": "Radar de eventos",
            "headline_en": "Event calendar requires review",
            "headline_es": "El calendario de eventos requiere revisión",
            "metric_en": "No future reviewed events",
            "metric_es": "No hay eventos futuros revisados",
            "why_en": "Add the next decision-relevant official dates before publishing a new executive event signal.",
            "why_es": "Agrega las próximas fechas oficiales relevantes para decisiones antes de publicar una nueva señal ejecutiva.",
            "source_status": "Review required",
            "sources": [],
        }, None

    metric_en = " · ".join(event["short_en"] for _, event in selected)
    metric_es = " · ".join(event["short_es"] for _, event in selected)
    sources = []
    for _, event in selected:
        if event.get("source"):
            sources.append(event["source"])
        elif event.get("project_id") and event["project_id"] in projects_by_id:
            project = projects_by_id[event["project_id"]]
            sources.append({
                "name": f"CF Investing {project.get('name', 'project')} profile",
                "url_en": project.get("profile_url", "/projects/"),
                "url_es": project.get("profile_url_es", "/es/proyectos/"),
            })

    return {
        "id": "events-next-reviewed",
        "type": "events",
        "label_en": "Events radar",
        "label_es": "Radar de eventos",
        "headline_en": "The next dates can reset the decision cycle",
        "headline_es": "Las próximas fechas pueden redefinir el ciclo de decisión",
        "metric_en": metric_en,
        "metric_es": metric_es,
        "why_en": "These reviewed dates can change rate expectations or documented project decision timelines, so they belong on the executive watchlist.",
        "why_es": "Estas fechas revisadas pueden cambiar expectativas de tasas o cronogramas documentados de decisión de proyectos, por lo que deben estar en el radar ejecutivo.",
        "source_status": "Primary sources + Source Reviewed",
        "sources": sources,
    }, selected[0][0]


def write_output_flag(name: str, value: str) -> None:
    target = os.environ.get("GITHUB_OUTPUT")
    if target:
        with open(target, "a", encoding="utf-8") as handle:
            handle.write(f"{name}={value}\n")


def main() -> int:
    inputs = load(INPUTS)
    project_data = load(PROJECTS)
    projects = project_data.get("projects", [])
    projects_by_id = {p.get("id"): p for p in projects if p.get("id")}
    today = date.today()

    markets = inputs["markets"]
    market_valid_through = parse_day(markets["valid_through"])
    market_stale = today > market_valid_through

    project = choose_capital_project(projects, inputs.get("capital", {}).get("fallback_project_id"))
    events, next_event = event_signal(inputs.get("events", []), projects_by_id, today)
    events_stale = next_event is None

    reviewed_dates = [parse_day(markets["reviewed_at"])]
    if project.get("last_reviewed"):
        reviewed_dates.append(parse_day(project["last_reviewed"]))
    updated_at = max(reviewed_dates)

    review_candidates = [market_valid_through]
    if next_event:
        review_candidates.append(next_event)
    review_by = min(review_candidates)

    review_required = market_stale or events_stale
    pulse = {
        "schema_version": "1.1",
        "updated_at": updated_at.isoformat(),
        "review_by": review_by.isoformat(),
        "status": "review_required" if review_required else "active",
        "policy": "Curated executive signals. Facts are linked to primary or source-reviewed records; implications are CF Investing analytical interpretation, not investment advice.",
        "automation": "Semi-automatic: reviewed market/event inputs + latest source-reviewed Project Intelligence capital case.",
        "signals": [
            market_signal(markets, market_stale),
            capital_signal(project),
            events,
        ],
    }

    if len(pulse["signals"]) != 3:
        raise RuntimeError("CF Pulse must contain exactly three executive signals")

    rendered = json.dumps(pulse, ensure_ascii=False, indent=2) + "\n"
    old = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
    changed = old != rendered
    if changed:
        OUTPUT.write_text(rendered, encoding="utf-8")

    write_output_flag("changed", "true" if changed else "false")
    write_output_flag("review_required", "true" if review_required else "false")
    write_output_flag("review_by", review_by.isoformat())
    print(json.dumps({
        "changed": changed,
        "review_required": review_required,
        "review_by": review_by.isoformat(),
        "capital_project": project.get("id"),
        "signals": 3,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
