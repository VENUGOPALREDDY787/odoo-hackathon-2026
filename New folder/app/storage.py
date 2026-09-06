"""File-based storage for generated invoices.

Each invoice is stored as:
- <OUTPUT_DIR>/<invoice_id>.pdf  -> the generated PDF
- <OUTPUT_DIR>/<invoice_id>.json -> the request metadata (for debugging)

Old files are purged on every write based on PDF_TTL_HOURS (default 24h).
This keeps the store stateless so the container can be restarted freely.
"""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from pathlib import Path

from .models import InvoiceRequest

_ID_RE = re.compile(r"^[a-f0-9]{32}$")


def output_dir() -> Path:
    path = Path(os.environ.get("OUTPUT_DIR", "generated"))
    path.mkdir(parents=True, exist_ok=True)
    return path


def ttl_hours() -> int:
    try:
        return max(1, int(os.environ.get("PDF_TTL_HOURS", "24")))
    except ValueError:
        return 24


def _purge_old(now: float | None = None) -> None:
    """Delete PDFs/metadata older than the TTL."""
    now = now if now is not None else time.time()
    cutoff = now - ttl_hours() * 3600
    for path in output_dir().iterdir():
        if path.suffix in (".pdf", ".json"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
            except OSError:
                pass


def save(invoice: InvoiceRequest, pdf_bytes: bytes) -> str:
    """Persist the PDF + metadata and return the invoice id."""
    _purge_old()
    invoice_id = uuid.uuid4().hex
    out = output_dir()
    (out / f"{invoice_id}.pdf").write_bytes(pdf_bytes)
    (out / f"{invoice_id}.json").write_text(
        json.dumps(invoice.model_dump(mode="json"), indent=2), encoding="utf-8"
    )
    return invoice_id


def _paths(invoice_id: str) -> tuple[Path, Path] | None:
    if not _ID_RE.match(invoice_id):
        return None
    out = output_dir()
    pdf = out / f"{invoice_id}.pdf"
    meta = out / f"{invoice_id}.json"
    if not pdf.exists() or not meta.exists():
        return None
    return pdf, meta


def get_pdf(invoice_id: str) -> Path | None:
    paths = _paths(invoice_id)
    return paths[0] if paths else None


def get_metadata(invoice_id: str) -> dict | None:
    paths = _paths(invoice_id)
    if not paths:
        return None
    try:
        return json.loads(paths[1].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None