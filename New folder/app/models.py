"""Request/response schemas for the invoice generation service.

The structure mirrors the data Odoo puts on an invoice PDF: company (issuer),
partner (customer), invoice metadata, and journal items (lines).
"""

from __future__ import annotations

import base64
import binascii
import re
from datetime import date as date_type
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# Accepts "data:image/png;base64,...." or a bare base64 payload.
_LOGO_DATA_URI_RE = re.compile(
    r"^data:image/(png|jpe?g|gif|webp|svg\+xml);base64,"
)
_BARE_BASE64_RE = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")


class CompanyInfo(BaseModel):
    """The party issuing the invoice (appears in the header)."""

    name: str = Field(min_length=1, description="Company legal name")
    address: Optional[str] = None
    vat: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    logo_base64: Optional[str] = Field(
        default=None,
        description='Base64 logo, either raw or as a "data:image/png;base64,..." data URI',
    )

    @field_validator("logo_base64")
    @classmethod
    def _validate_logo(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        payload = value
        if _LOGO_DATA_URI_RE.match(value):
            payload = value.split(",", 1)[1]
        elif not _BARE_BASE64_RE.match(value):
            raise ValueError(
                "logo_base64 must be raw base64 or a data:image/...;base64, URI"
            )
        try:
            decoded = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("logo_base64 is not valid base64")
        if not decoded:
            raise ValueError("logo_base64 is empty")
        # Normalize to a data URI so the template can always use it directly.
        return f"data:image/png;base64,{base64.b64encode(decoded).decode('ascii')}"


class CustomerInfo(BaseModel):
    """The party the invoice is addressed to (Bill To block)."""

    name: str = Field(min_length=1)
    address: Optional[str] = None
    vat: Optional[str] = None
    email: Optional[str] = None


class InvoiceLine(BaseModel):
    """One journal item / invoice line."""

    description: str = Field(min_length=1)
    quantity: float = Field(default=1.0, gt=0)
    # Negative prices are allowed so credit notes/refunds can use negative lines.
    unit_price: float = Field(description="Unit price (negative allowed for refunds)")


class InvoiceMeta(BaseModel):
    """Invoice-level fields (Odoo: name, invoice_date, invoice_date_due, ref...)."""

    number: str = Field(min_length=1, description="Invoice number, e.g. INV/2026/0001")
    date: date_type = Field(description="Invoice date")
    due_date: Optional[date_type] = None
    reference: Optional[str] = None
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    kind: Literal["invoice", "credit_note"] = "invoice"
    payment_terms: Optional[str] = None
    notes: Optional[str] = None


class InvoiceRequest(BaseModel):
    """Full payload for generating one invoice PDF."""

    invoice: InvoiceMeta
    company: CompanyInfo
    customer: CustomerInfo
    lines: list[InvoiceLine] = Field(min_length=1)


class InvoiceCreated(BaseModel):
    """Response of POST /invoices."""

    invoice_id: str
    invoice_number: str
    download_url: str
    expires_in_hours: int