# ServicePilot

A work order app for my handyman business. We get work orders from property management companies, and this puts everything in one place: the work orders, a calendar of what's scheduled, and invoices for when the job's done.

Right now the front end is a working prototype that saves to the browser's localStorage. The back end is the start of reading work order PDFs automatically with OCR.

## Front end (`frontend/`)

Plain HTML/CSS/JS with no framework or build step. Open `frontend/index.html` and it runs. There are three pages you switch between in the nav: Work Orders, Calendar, and Invoices.

Everything is in `app.js`, grouped below by what it's for.

### Data and storage

A work order looks like `{ id, num, customer, phone, address, description, priority, status, appointmentDate, seen, created }`. Status is one of `new`, `scheduled`, `progress`, or `done`.

- `load()` - reads work orders from localStorage. If there's nothing there it loads the sample data. It also fills in fields that older saved records didn't have (`seen`, `appointmentDate`, `created`) so old data still works after I changed the format.
- `seedData()` - three fake work orders so the app isn't empty the first time
- `save()` - writes work orders back to localStorage
- `cryptoId()` - random ID for a new record. Despite the name it isn't crypto, it's `Math.random` plus a timestamp.
- `nextTicketNum()` - finds the highest `WO-####` number and adds one
- `nextDays(days)` - date string N days from today, only used for the sample data

### Date helpers

- `pad2(n)`, `dateKey(d)`, `todayKey()`, `startOfMonth(d)` - build `YYYY-MM-DD` keys. Dates are compared as strings everywhere so I don't have to deal with timezones.
- `formatDate(str)` - `2026-09-23` -> `Sep 23`
- `formatCreated(ts)` - timestamp -> `Sep 23, 2026`

### Work order list

- `render()` - the main redraw. Updates the filters, the list, the bulk bar, the Select button, and the counts in the nav, plus the calendar or invoices if you're on those pages. Pretty much every change ends by calling this.
- `renderFilters()` - the tabs across the top (Active, New, Scheduled, In Progress, Done, All) with a count on each. Active means everything that isn't done.
- `setFilter(id)` - switches tabs
- `filteredOrders()` - the orders for the current tab, sorted by priority (urgent, high, normal, low) and then by appointment date. Orders with no date go last.
- `renderList()` - draws the cards. Each card is wrapped in a `.ticket-swipe` div with the Done and Unseen backgrounds behind it, which show when you swipe. Unseen orders get a dot next to the customer name.
- `statusLabel(id)` - `progress` -> `In Progress`
- `escapeHtml(str)` - escapes anything I put into innerHTML so a customer named `<script>` can't break the page
- `switchPage(page)` - shows one page and hides the other two

### Swipe gestures

Swipe a card right to mark it done, swipe left to mark it unseen (like marking an email unread). It uses pointer events so it works with a mouse and on a phone.

- The pointerdown listener on the list remembers which card you grabbed and where
- The pointermove listener moves the card with you, limited to 130px either way
- `applyDragVisual(state)` - moves the card and fades in the background behind it depending on the direction
- `endDrag()` - if you went past 84px it calls `markDone` or `markUnseen`. It also blocks the click that fires right after a swipe so you don't swipe a card and open it by accident.
- `resetDragVisual(state)` - animates the card back to where it was
- `markDone(id)` / `markUnseen(id)` - change the order, save, and redraw

### Select mode and bulk actions

- `toggleSelectMode()` - turns select mode on or off and clears the selection
- `toggleSelect(id)` - checks or unchecks one card
- `toggleSelectAll()` - selects everything in the current tab, or deselects if it's all already selected
- `renderBulkBar()` - the bar with the selected count and the "Mark as" status buttons
- `bulkSetStatus(status)` - sets every selected order to that status

### Work order panel

The slide-out form for creating or editing a work order.

- `openPanel(id, prefillAppointment)` - with an id it fills the form from that order, shows Delete and "Bill this job", and marks the order as seen. With no id it's a blank form with the next ticket number and the PDF upload box. `prefillAppointment` is used when you hit "+ Add for this day" on the calendar.
- `renderStatusRow(selected)` / `selectStatus(id)` / `getSelectedStatus()` - the status pills in the form
- `saveTicket()` - customer name is required. If you set an appointment date and leave the status as New, it bumps it to Scheduled automatically. Then it updates or creates the order.
- `deleteTicket()` - confirms, then deletes
- `closePanel()` - closes it and redraws

Keyboard: Esc closes whatever's open (or leaves select mode), and Cmd/Ctrl+N opens a new work order.

### Calendar

- `calPrevMonth()`, `calNextMonth()`, `calGoToday()` - move around
- `ordersByDate()` - groups orders by appointment date into `{ 'YYYY-MM-DD': [orders] }`
- `sortByPriority(list)` - sorts one day's orders by priority
- `renderCalendar()` - builds a 6-week grid (42 cells) that includes the end of last month and the start of next month so the weeks line up. Each day shows its top 2 orders by priority and "+N more" for the rest. Also marks today and the selected day.
- `renderAgenda()` - the list under the calendar for whatever day you clicked, with a button to add a work order on that day

One click listener on the calendar page handles everything: a chip or agenda card opens that order, the add button opens a new one, and a day cell selects that day.

### Invoices

An invoice has one labor line (description, hours, rate) and any number of item lines (parts or extra labor). It can be linked back to the work order it came from.

- `loadInvoices()` / `saveInvoices()` - localStorage, same as work orders
- `nextInvoiceNum()` - highest invoice number plus one, starting at 101
- `invFmtMoney(n)` - `$12.50`
- `invFmtDateDisplay(iso)` - `September 23, 2026`
- `openInvoicePanel(existingInvoiceId, fromWorkOrder)` - opens an existing invoice or starts a new one. A new invoice defaults to today with payment due in 30 days, 1 hour of labor at $25. If it came from a work order it fills in the customer and address.
- `closeInvoicePanel()` - closes it and clears which invoice and work order it was tied to
- `billThisJob()` - the "Bill this job" button on a work order. Closes that panel and opens a new invoice linked to it.
- `makeInvoiceItemRow(prefill)` - adds an item card (description, qty, cost each, and type: Part, Labor, or Billed to tenant). A small `recalc()` inside it updates the line total as you type.
- `invCollectItems()` - reads all the item cards into an array and skips any empty ones
- `invGenerate()` - labor description is required. Adds up labor plus items, saves the invoice (updating it if you're editing one), and shows the preview.
- `renderInvoiceReceipt(data)` - the invoice preview: bill to, job location, dates, the line items, and the total
- `updateInvLinkedTag()` - shows "Linked to work order WO-####"
- `renderInvoiceList()` - the invoices page, newest first
- Copy for Sheets button - copies the invoice as tab-separated text so it pastes straight into Google Sheets as rows and columns
- Print / Save PDF button - just `window.print()`, and the print CSS takes care of the layout
- `flashInvCopy()` - the "Copied" message

## Back end (`backend/`)

Early. This is supposed to take a work order PDF and turn it into a work order without me typing it in.

- `Main.py` - loops through every PDF in `backend/pdfs/`, converts it to images, and runs OCR on it. The field extraction step is still commented out.
- `pdf_to_image.py` - `pdf_to_image(filename, input_folder, output_folder)` converts each page to a JPG with pdf2image and saves it as `<name>_page<N>.jpg`
- `run_pyesseract.py` - `run_pytesseract(image)` runs Tesseract with a character whitelist and the noise filtering turned down, and returns word-level data (text plus position) instead of one block of text, so I can find a label and then look for the value next to it
- `extract_data_from_text.py` - empty for now. This is where pulling out the customer, address, and description will go.

To run it you need poppler and tesseract (`brew install poppler tesseract`) and `pip install pdf2image pytesseract`. Real work orders have tenant info in them so `backend/pdfs/` is gitignored.

### Not working yet

- `Main.py` has the full paths to my machine hardcoded for the input and output folders
- `pdf_to_image` saves the images but doesn't return anything, so `Main.py` passes `None` into the OCR
- `run_pytesseract` calls `custom_config()`, but that's a string and not a function, so it throws. That line needs to go.
- The whitelist line in `custom_config` is missing a space at the end, so it runs straight into the next `-c` option

## Where it's going

The plan is FastAPI and PostgreSQL behind this instead of localStorage, a separate view for dispatch and for techs, work orders coming in by email, PDF upload, or typed in by hand, text/email updates to tenants, and making it work offline as an installable app. I want to use it for my own business first and then see if other small companies want it.
