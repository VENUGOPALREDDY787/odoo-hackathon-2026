# Invoice PDF Generator

A standalone, containerized microservice that generates invoice PDFs from a JSON
request. The PDF layout (company branding header, Bill To block, invoice metadata,
line-items table, totals, notes) is modeled on Odoo's invoice document layout, and
the request schema mirrors the fields Odoo keeps on an `account.move`.

> **Note on the Odoo source:** Odoo's invoice generation cannot run outside the Odoo
> framework — the `account.move` model depends on the ORM, `account.journal`,
> `account.tax`, `res.partner`, `res.company` and the QWeb report engine. This
> project extracts the *behavior* of invoice generation (inputs → totals → PDF) into
> a self-contained service with zero Odoo dependency.

## Quick start

```bash
docker compose up --build
```

The API is then available at `http://localhost:8000`.

### 1. Generate an invoice

```bash
curl -X POST http://localhost:8000/invoices \
  -H "Content-Type: application/json" \
  -d @examples/sample_request.json
```

Response (`201 Created`):

```json
{
  "invoice_id": "ccdee87ed9ce4ac8abf923f89013ffe8",
  "invoice_number": "INV/2026/0042",
  "download_url": "/invoices/ccdee87ed9ce4ac8abf923f89013ffe8/pdf",
  "expires_in_hours": 24
}
```

### 2. Download the PDF

```bash
curl -OJ http://localhost:8000/invoices/ccdee87ed9ce4ac8abf923f89013ffe8/pdf
```

The response is `application/pdf` with a `Content-Disposition: attachment` header.

Pre-generated examples live in [`examples/`](examples/):

- [`sample_invoice.pdf`](examples/sample_invoice.pdf) — standard invoice
- [`sample_credit_note_with_logo.pdf`](examples/sample_credit_note_with_logo.pdf) — credit note with embedded logo
- [`sample_request.json`](examples/sample_request.json) — the payload used for the invoice

## API

| Method | Path                          | Description                                             |
| ------ | ----------------------------- | ------------------------------------------------------- |
| `POST` | `/invoices`                   | Generate a PDF, return an `invoice_id` + download URL   |
| `GET`  | `/invoices/{invoice_id}/pdf`  | Download the generated PDF                              |
| `GET`  | `/invoices/{invoice_id}`      | Fetch the original request payload (metadata)           |
| `GET`  | `/health`                     | Health check (also shows TTL and output dir)            |
| `GET`  | `/`                           | Service info                                            |

Validation errors return `422` with a Pydantic detail; unknown/expired ids return `404`.

## Request schema

```jsonc
{
  "invoice": {
    "number": "INV/2026/0042",          // required, invoice number
    "date": "2026-09-06",               // required, invoice date (YYYY-MM-DD)
    "due_date": "2026-10-06",           // optional
    "reference": "SO-1042",             // optional, e.g. sales order reference
    "currency": "EUR",                  // optional, ISO 4217 (default "EUR")
    "kind": "invoice",                  // optional, "invoice" | "credit_note"
    "payment_terms": "...",             // optional, free text
    "notes": "..."                      // optional, free text
  },
  "company": {                          // the issuer (printed in the header)
    "name": "Acme Solutions BV",        // required
    "address": "Keizersgracht 100\n1015 CV Amsterdam",  // optional, "\n" = line break
    "vat": "NL123456789B01",            // optional
    "email": "billing@acme.nl",         // optional
    "phone": "+31 20 123 4567",         // optional
    "website": "www.acme.nl",           // optional
    "logo_base64": "data:image/png;base64,..."  // optional, raw or data-URI base64
  },
  "customer": {                         // the recipient (Bill To block)
    "name": "Jane Doe",                 // required
    "address": "42 Customer Lane\nLondon",  // optional
    "vat": "GB987654321",               // optional
    "email": "jane@example.com"         // optional
  },
  "lines": [                            // required, at least one line
    {
      "description": "Website design & development",  // required
      "quantity": 1,                    // > 0
      "unit_price": 2500.00             // negative allowed for credit note lines
    }
  ]
}
```

Totals are computed as `sum(quantity * unit_price)` per line; the PDF shows
Untaxed Amount, Total and Amount Due. For `kind: "credit_note"` the document is
titled "Credit Note" and negative line prices render as negative amounts.

## Configuration (environment variables)

| Variable        | Default          | Description                                            |
| --------------- | ---------------- | ------------------------------------------------------ |
| `PDF_TTL_HOURS` | `24`             | How long generated PDFs are kept before cleanup        |
| `OUTPUT_DIR`    | `/app/generated` | Where PDFs + request metadata are stored               |

PDFs are stored as `<OUTPUT_DIR>/<invoice_id>.pdf` (plus a `.json` with the request
payload). Old files are purged automatically on every write. `docker-compose.yml`
mounts `./generated` so files survive container restarts.

## Running without Docker

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

WeasyPrint needs the Pango system libraries on non-Docker hosts
(e.g. `libpango-1.0-0 libpangoft2-1.0-0` on Debian/Ubuntu).

## Extending

The rendering pipeline is small and easy to extend:

- `app/models.py` — request/response schemas (add e.g. per-line tax rates here)
- `app/render.py` — totals computation and template context
- `templates/invoice.html` — the Odoo-style invoice layout (HTML/CSS, WeasyPrint)

Adding line-level percentage taxes, multi-currency rates, or a company-specific
accent color each touch only one or two of these files.