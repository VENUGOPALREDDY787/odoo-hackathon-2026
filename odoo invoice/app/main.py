"""Invoice generation service.

Flow:
  1. POST /invoices    with the invoice JSON -> returns an invoice_id + download URL
  2. GET  /invoices/{invoice_id}/pdf  -> returns the generated PDF

Run locally:  uvicorn app.main:app --reload
Run in Docker: docker compose up --build
"""

from __future__ import annotations

import re

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from . import render, storage
from .models import InvoiceCreated, InvoiceRequest

app = FastAPI(
    title="Invoice PDF Generator",
    description="Generate an invoice PDF from JSON. Modeled on Odoo's invoice document layout.",
    version="1.0.0",
)

_FILENAME_SAFE_RE = re.compile(r"[^A-Za-z0-9._-]+")


@app.get("/")
def root() -> dict:
    return {
        "service": "Invoice PDF Generator",
        "usage": {
            "generate": "POST /invoices with the invoice JSON (see README for the schema)",
            "download": "GET /invoices/{invoice_id}/pdf",
        },
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "ttl_hours": storage.ttl_hours(), "output_dir": str(storage.output_dir())}


@app.post("/invoices", response_model=InvoiceCreated, status_code=201)
def create_invoice(payload: InvoiceRequest) -> InvoiceCreated:
    """Generate an invoice PDF and store it. Returns an id to download it with."""
    pdf_bytes = render.render_pdf(payload)
    invoice_id = storage.save(payload, pdf_bytes)
    return InvoiceCreated(
        invoice_id=invoice_id,
        invoice_number=payload.invoice.number,
        download_url=f"/invoices/{invoice_id}/pdf",
        expires_in_hours=storage.ttl_hours(),
    )


@app.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str) -> FileResponse:
    """Download the PDF for a previously generated invoice."""
    pdf_path = storage.get_pdf(invoice_id)
    if pdf_path is None:
        raise HTTPException(status_code=404, detail="Invoice not found or expired")
    filename = _FILENAME_SAFE_RE.sub("-", pdf_path.stem) + ".pdf"
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=filename,
        content_disposition_type="attachment",
    )


@app.get("/invoices/{invoice_id}")
def get_invoice_metadata(invoice_id: str) -> JSONResponse:
    """Return the original request payload stored with the invoice."""
    metadata = storage.get_metadata(invoice_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Invoice not found or expired")
    return JSONResponse(metadata)