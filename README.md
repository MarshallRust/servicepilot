# ServicePilot

A field-service management app for small maintenance and handyman companies: work orders, scheduling and invoicing in one mobile-first tool. It's built around how a property-maintenance business actually runs, with work orders coming in from property managers, getting scheduled, completed and invoiced.

> **Status: working front-end prototype. Back end in progress.**

## What works today (front end)

A single-page app (`frontend/`) with data saved in the browser's localStorage:

- **Work orders:** create, edit and delete; status flow *New → Scheduled → In Progress → Done*; filters; **swipe actions** on cards; multi-select for bulk actions.
- **Calendar:** month view of scheduled work, with a day agenda.
- **Invoices:** build line-item invoices linked to a work order, then **copy for Google Sheets** or **print / save as PDF**.
- Mobile-first, responsive layout.

Open `frontend/index.html` in a browser to try it. There's no build step.

## In progress (back end)

Automatic intake of work orders from the PDFs property managers send:

```
work-order PDF ──► pdf_to_image.py (pdf2image) ──► run_pyesseract.py (Tesseract OCR) ──► extract fields ──► work order
```

PDF-to-image conversion and OCR are in place. Field extraction (`extract_data_from_text.py`) is next.

## Roadmap

- FastAPI + PostgreSQL back end to replace localStorage
- Separate dispatcher and technician views
- Intake by email parsing, PDF/OCR upload or manual entry
- Tenant SMS/email updates
- Installable offline PWA

## Tech

Vanilla JavaScript, HTML and CSS (prototype) · Python, pdf2image, Tesseract (intake) · planned: FastAPI, PostgreSQL, React/TypeScript

## Setup (OCR pipeline)

```bash
brew install poppler tesseract
pip install pdf2image pytesseract
python backend/Main.py
```

Put sample PDFs in `backend/pdfs/`. That folder is git-ignored because real work orders contain client and tenant information.
