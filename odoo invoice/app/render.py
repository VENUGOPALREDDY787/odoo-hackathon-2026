"""PDF rendering: Jinja2 template -> WeasyPrint -> PDF bytes."""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

from .models import InvoiceRequest

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)

# Common ISO 4217 codes -> display symbol. Unlisted codes fall back to the code itself.
_CURRENCY_SYMBOLS = {
    "EUR": "€",
    "USD": "$",
    "GBP": "£",
    "INR": "₹",
    "JPY": "¥",
    "CNY": "¥",
    "CHF": "CHF",
    "CAD": "$",
    "AUD": "$",
    "NZD": "$",
    "SGD": "$",
    "HKD": "$",
    "BRL": "R$",
    "MXN": "$",
    "AED": "AED",
    "SAR": "SAR",
    "ZAR": "R",
    "SEK": "kr",
    "NOK": "kr",
    "DKK": "kr",
    "PLN": "zł",
    "CZK": "Kč",
    "RUB": "₽",
    "KRW": "₩",
    "TRY": "₺",
    "ILS": "₪",
}
# Currencies that conventionally put the symbol after the amount.
_SUFFIX_SYMBOLS = {"SEK", "NOK", "DKK", "PLN", "CZK", "CHF", "AED", "SAR"}


def format_amount(value: float, currency: str) -> str:
    number = f"{value:,.2f}"
    symbol = _CURRENCY_SYMBOLS.get(currency, currency)
    if currency in _SUFFIX_SYMBOLS:
        return f"{number} {symbol}"
    return f"{symbol}{number}"


def _prepare(invoice: InvoiceRequest) -> dict:
    lines = []
    subtotal = 0.0
    for index, line in enumerate(invoice.lines, start=1):
        amount = round(line.quantity * line.unit_price, 2)
        subtotal += amount
        lines.append(
            {
                "index": index,
                "description": line.description,
                "quantity": f"{line.quantity:g}",
                "unit_price": f"{line.unit_price:,.2f}",
                "amount": format_amount(amount, invoice.invoice.currency),
                "amount_raw": amount,
            }
        )

    meta = invoice.invoice
    total = round(subtotal, 2)
    return {
        "kind_title": "Credit Note" if meta.kind == "credit_note" else "Invoice",
        "invoice_number": meta.number,
        "invoice_date": meta.date.isoformat(),
        "due_date": meta.due_date.isoformat() if meta.due_date else None,
        "reference": meta.reference,
        "payment_terms": meta.payment_terms,
        "currency": meta.currency,
        "currency_symbol": _CURRENCY_SYMBOLS.get(meta.currency, meta.currency),
        "company": invoice.company,
        "customer": invoice.customer,
        "lines": lines,
        "subtotal": format_amount(subtotal, meta.currency),
        "total": format_amount(total, meta.currency),
        "amount_due": format_amount(total, meta.currency),
        "notes": meta.notes,
        "has_logo": bool(invoice.company.logo_base64),
        "logo": invoice.company.logo_base64,
    }


def render_pdf(invoice: InvoiceRequest) -> bytes:
    """Render an invoice request to PDF bytes."""
    context = _prepare(invoice)
    template = _env.get_template("invoice.html")
    html = template.render(**context)
    return HTML(string=html).write_pdf()