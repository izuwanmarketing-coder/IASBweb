"use client";

import { useEffect, useId, useMemo, useState } from "react";
import clsx from "clsx";
import { BadgeDollarSign, Building2, Car, Check, Download, Edit3, FileText, Home, Menu, Plus, Save, Search, Settings, Trash2, X } from "lucide-react";
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  InvoiceType,
  blankInvoice,
  calculateInvoice,
  defaultCompany,
  money,
  sampleInvoices
} from "@/lib/invoice";

type View = "dashboard" | "create" | "preview" | "history" | "settings";

const storageKey = "izuwan-invoices-v1";
const companyKey = "izuwan-company-v1";
const statuses: InvoiceStatus[] = ["Draft", "Pending", "Paid", "Cancelled"];
const invoiceTypes: InvoiceType[] = ["Vehicle Sale", "Custom Invoice"];

function normalizeInvoices(value: unknown, company: typeof defaultCompany): Invoice[] {
  if (!Array.isArray(value)) return sampleInvoices();

  return value.map((invoice, index) => {
    const fallback = blankInvoice(index, company);
    const next = { ...fallback, ...invoice, company } as Invoice;
    next.invoiceType = next.invoiceType ?? "Vehicle Sale";
    next.customer = { ...fallback.customer, ...(invoice as Partial<Invoice>)?.customer };
    next.vehicle = { ...fallback.vehicle, ...(invoice as Partial<Invoice>)?.vehicle };
    next.payment = { ...fallback.payment, ...(invoice as Partial<Invoice>)?.payment };
    next.items = Array.isArray((invoice as Partial<Invoice>)?.items) && (invoice as Partial<Invoice>).items!.length ? (invoice as Partial<Invoice>).items! : fallback.items;
    return next;
  });
}

export default function InvoiceGenerator() {
  const [view, setView] = useState<View>("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [current, setCurrent] = useState<Invoice | null>(null);
  const [company, setCompany] = useState(defaultCompany);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | InvoiceStatus>("All");
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Invoice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedCompany = localStorage.getItem(companyKey);
      const savedInvoices = localStorage.getItem(storageKey);
      const parsedCompany = savedCompany ? { ...defaultCompany, ...JSON.parse(savedCompany) } : defaultCompany;
      const parsedInvoices = savedInvoices ? normalizeInvoices(JSON.parse(savedInvoices), parsedCompany) : sampleInvoices();
      setCompany(parsedCompany);
      setInvoices(parsedInvoices);
      setCurrent(blankInvoice(parsedInvoices.length, parsedCompany));
    } catch {
      const fallbackInvoices = sampleInvoices();
      setCompany(defaultCompany);
      setInvoices(fallbackInvoices);
      setCurrent(blankInvoice(fallbackInvoices.length, defaultCompany));
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(invoices));
  }, [invoices, ready]);

  useEffect(() => {
    if (ready) localStorage.setItem(companyKey, JSON.stringify(company));
  }, [company, ready]);

  const selectedInvoice = current ?? blankInvoice(invoices.length, company);
  const totals = useMemo(() => invoices.map((invoice) => calculateInvoice(invoice)), [invoices]);
  const filteredInvoices = invoices.filter((invoice) => {
    const haystack = `${invoice.invoiceNumber} ${invoice.invoiceType ?? "Vehicle Sale"} ${invoice.customer.fullName} ${invoice.vehicle.make} ${invoice.vehicle.model} ${invoice.items.map((item) => item.description).join(" ")}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === "All" || invoice.status === filter);
  });
  const stats = {
    count: invoices.length,
    value: totals.reduce((sum, total) => sum + total.totalPayable, 0),
    paid: totals.reduce((sum, total) => sum + total.paid, 0),
    balance: totals.reduce((sum, total) => sum + total.balance, 0)
  };

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const updateCurrent = (patch: Partial<Invoice>) => {
    setCurrent({ ...selectedInvoice, ...patch, updatedAt: new Date().toISOString() });
  };

  const saveInvoice = () => {
    const invoice = { ...selectedInvoice, company, updatedAt: new Date().toISOString() };
    setInvoices((list) => {
      const exists = list.some((item) => item.id === invoice.id);
      return exists ? list.map((item) => (item.id === invoice.id ? invoice : item)) : [invoice, ...list];
    });
    setCurrent(invoice);
    notify("Invoice saved locally");
  };

  const newInvoice = () => {
    setCurrent(blankInvoice(invoices.length, company));
    setView("create");
    notify("New invoice ready");
  };

  const editInvoice = (invoice: Invoice) => {
    setCurrent({ ...invoice, company });
    setView("create");
  };

  const deleteInvoice = () => {
    if (!confirmDelete) return;
    setInvoices((list) => list.filter((invoice) => invoice.id !== confirmDelete.id));
    if (current?.id === confirmDelete.id) setCurrent(blankInvoice(invoices.length, company));
    setConfirmDelete(null);
    notify("Invoice deleted");
  };

  const printInvoice = () => {
    saveInvoice();
    window.setTimeout(() => window.print(), 100);
  };

  if (!current) {
    return (
      <main className="grid min-h-screen place-items-center bg-mist">
        <div className="rounded-lg border border-black/10 bg-white p-8 text-center shadow-soft">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-ink text-gold">
            <FileText size={20} />
          </div>
          <p className="mt-4 text-sm font-medium text-graphite">Loading invoice studio</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f7f5_0%,#eeeeea_48%,#f7f7f5_100%)]">
      <div className="flex min-h-screen">
        <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-[linear-gradient(180deg,#090909,#151515)] text-white shadow-premium lg:block">
          <BrandBlock />
          <Nav view={view} setView={setView} newInvoice={newInvoice} />
        </aside>

        <section className="min-w-0 flex-1 lg:pl-64">
          <TopBar view={view} setView={setView} newInvoice={newInvoice} />
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {view === "dashboard" && (
              <Dashboard stats={stats} invoices={filteredInvoices.slice(0, 6)} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} editInvoice={editInvoice} />
            )}
            {view === "create" && <CreateInvoice invoice={selectedInvoice} updateInvoice={updateCurrent} saveInvoice={saveInvoice} printInvoice={printInvoice} />}
            {view === "preview" && <PreviewPage invoice={selectedInvoice} saveInvoice={saveInvoice} printInvoice={printInvoice} />}
            {view === "history" && (
              <History invoices={filteredInvoices} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} editInvoice={editInvoice} confirmDelete={setConfirmDelete} />
            )}
            {view === "settings" && <SettingsPage company={company} setCompany={setCompany} notify={notify} />}
          </div>
        </section>
      </div>

      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-medium text-white shadow-premium">
          <Check size={16} className="text-gold" />
          {toast}
        </div>
      )}

      {confirmDelete && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-premium">
            <h2 className="text-lg font-semibold text-ink">Delete invoice?</h2>
            <p className="mt-2 text-sm text-graphite">This will remove {confirmDelete.invoiceNumber} from local history on this browser.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white" onClick={deleteInvoice}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BrandBlock() {
  return (
    <div className="border-b border-white/10 p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 -skew-x-6 place-items-center border border-gold bg-white/5 text-sm font-black text-gold">IA</div>
        <div>
          <p className="text-sm font-extrabold uppercase tracking-wide">Izuwan Automobile</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Japan Recond Specialist</p>
        </div>
      </div>
    </div>
  );
}

function Nav({ view, setView, newInvoice }: { view: View; setView: (view: View) => void; newInvoice: () => void }) {
  const items = [
    ["dashboard", Home, "Dashboard"],
    ["create", Plus, "Create Invoice"],
    ["preview", FileText, "Invoice Preview"],
    ["history", Search, "Invoice History"],
    ["settings", Settings, "Company Settings"]
  ] as const;
  return (
    <nav className="space-y-2 p-4">
      {items.map(([key, Icon, label]) => (
        <button
          key={key}
          onClick={() => (key === "create" ? newInvoice() : setView(key))}
          className={clsx(
            "flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition",
            view === key ? "bg-gold text-white shadow-soft" : "text-white/62 hover:bg-white/10 hover:text-white"
          )}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}
    </nav>
  );
}

function TopBar({ view, setView, newInvoice }: { view: View; setView: (view: View) => void; newInvoice: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="no-print sticky top-0 z-20 border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold">Established 2011 · 100% Bumiputera</p>
          <h1 className="text-xl font-extrabold text-ink sm:text-2xl">Invoice Generator</h1>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button onClick={() => setView("history")} className="border border-black/10 bg-white px-4 py-2 text-sm font-bold text-ink shadow-soft">
            History
          </button>
          <button onClick={newInvoice} className="flex items-center gap-2 bg-gold px-4 py-2 text-sm font-extrabold text-white shadow-soft">
            <Plus size={16} />
            New Invoice
          </button>
        </div>
        <button onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-md border border-black/10 md:hidden">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg border border-black/10 bg-white p-2 shadow-soft md:hidden">
          <Nav view={view} setView={(next) => { setView(next); setOpen(false); }} newInvoice={() => { newInvoice(); setOpen(false); }} />
        </div>
      )}
    </header>
  );
}

function Dashboard({ stats, invoices, query, setQuery, filter, setFilter, editInvoice }: any) {
  const cards = [
    ["Total invoices", stats.count, FileText],
    ["Total invoice value", money(stats.value), BadgeDollarSign],
    ["Total paid", money(stats.paid), Check],
    ["Outstanding balance", money(stats.balance), Building2]
  ];
  return (
    <div className="space-y-6">
      <section className="overflow-hidden border border-black/10 bg-ink p-6 text-white shadow-premium sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-gold">Invoice command center</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Luxury dealership billing, quick enough for the sales floor.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Vehicle sale invoices, accessories, service items, deposits and custom charges in one internal workspace.</p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3 text-sm">
            <div className="border border-white/10 bg-white/5 p-4"><span className="text-white/45">Paid</span><b className="mt-1 block text-lg">{money(stats.paid)}</b></div>
            <div className="border border-white/10 bg-white/5 p-4"><span className="text-white/45">Outstanding</span><b className="mt-1 block text-lg text-gold">{money(stats.balance)}</b></div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon]: any) => (
          <div key={label} className="group border border-black/10 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-premium">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-graphite">{label}</p>
              <span className="grid h-10 w-10 place-items-center bg-mist text-gold transition group-hover:bg-ink"><Icon size={19} /></span>
            </div>
            <p className="mt-5 text-2xl font-black tracking-tight text-ink">{value}</p>
          </div>
        ))}
      </section>
      <SearchBar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
      <InvoiceTable invoices={invoices} editInvoice={editInvoice} />
    </div>
  );
}

function SearchBar({ query, setQuery, filter, setFilter }: any) {
  return (
    <div className="no-print flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4 shadow-soft md:flex-row">
      <label className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite" size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, invoice, vehicle or item" className="h-12 w-full border border-black/10 bg-mist pl-10 pr-3 text-sm font-medium outline-none transition focus:border-gold focus:bg-white" />
      </label>
      <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-12 border border-black/10 bg-mist px-3 text-sm font-bold outline-none transition focus:border-gold focus:bg-white">
        <option>All</option>
        {statuses.map((status) => <option key={status}>{status}</option>)}
      </select>
    </div>
  );
}

function CreateInvoice({ invoice, updateInvoice, saveInvoice, printInvoice }: any) {
  const invoiceType: InvoiceType = invoice.invoiceType ?? "Vehicle Sale";
  const isVehicle = invoiceType === "Vehicle Sale";
  const updateVehicle = (patch: any) => updateInvoice({ vehicle: { ...invoice.vehicle, ...patch } });
  const vehicleLineName = (vehicle = invoice.vehicle) => [vehicle.year, vehicle.make, vehicle.model, vehicle.variant].filter(Boolean).join(" ") || "Vehicle selling price";
  const updateVehicleWithLineItem = (patch: any) => {
    const vehicle = { ...invoice.vehicle, ...patch };
    const existingItems = invoice.items.length ? invoice.items : [{ id: crypto.randomUUID(), description: "Vehicle selling price", quantity: 1, unitPrice: 0 }];
    const items = [
      {
        ...existingItems[0],
        description: vehicleLineName(vehicle),
        quantity: 1,
        unitPrice: Number(vehicle.sellingPrice) || 0
      },
      ...existingItems.slice(1)
    ];
    updateInvoice({ vehicle, items });
  };
  const updateCustomer = (patch: any) => updateInvoice({ customer: { ...invoice.customer, ...patch } });
  const updatePayment = (patch: any) => updateInvoice({ payment: { ...invoice.payment, ...patch } });
  const syncItems = () => {
    const vehicleName = vehicleLineName();
    const items: InvoiceItem[] = [
      { id: invoice.items[0]?.id ?? crypto.randomUUID(), description: vehicleName, quantity: 1, unitPrice: Number(invoice.vehicle.sellingPrice) || 0 },
      ...(Number(invoice.payment.insurance) > 0 ? [{ id: invoice.items[1]?.id ?? crypto.randomUUID(), description: "Insurance", quantity: 1, unitPrice: Number(invoice.payment.insurance) }] : []),
      ...(Number(invoice.payment.roadTax) > 0 ? [{ id: crypto.randomUUID(), description: "Road tax", quantity: 1, unitPrice: Number(invoice.payment.roadTax) }] : []),
      ...(Number(invoice.payment.jpjFee) > 0 ? [{ id: crypto.randomUUID(), description: "JPJ / registration", quantity: 1, unitPrice: Number(invoice.payment.jpjFee) }] : []),
      ...(Number(invoice.payment.processingFee) > 0 ? [{ id: crypto.randomUUID(), description: "Processing fee", quantity: 1, unitPrice: Number(invoice.payment.processingFee) }] : [])
    ];
    updateInvoice({ items });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.88fr)_minmax(460px,0.72fr)]">
      <div className="no-print space-y-4">
        <section className="border border-black/10 bg-ink p-5 text-white shadow-soft">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-gold">Invoice workspace</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">Create a polished invoice.</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/62">Pilih vehicle sale untuk kereta, atau custom invoice untuk accessories, service, parts, booking, admin charges dan barang lain.</p>
        </section>

        <FormCard title="Invoice">
          <SegmentedControl value={invoiceType} options={invoiceTypes} onChange={(value) => updateInvoice({ invoiceType: value })} />
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Invoice no." value={invoice.invoiceNumber} onChange={(value) => updateInvoice({ invoiceNumber: value })} />
            <Field label="Date" type="date" value={invoice.invoiceDate} onChange={(value) => updateInvoice({ invoiceDate: value })} />
            <Field label="Due" type="date" value={invoice.dueDate} onChange={(value) => updateInvoice({ dueDate: value })} />
            <SelectField label="Status" value={invoice.status} options={statuses} onChange={(value) => updateInvoice({ status: value })} />
          </div>
        </FormCard>

        <FormCard title="Customer / Buyer">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Name" value={invoice.customer.fullName} onChange={(value) => updateCustomer({ fullName: value })} />
            <Field label="Phone" value={invoice.customer.phone} onChange={(value) => updateCustomer({ phone: value })} />
          </div>
          <details className="advanced-panel">
            <summary>More customer details <span>+</span></summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="IC / Passport" value={invoice.customer.idNumber} onChange={(value) => updateCustomer({ idNumber: value })} />
              <Field label="Email" value={invoice.customer.email} onChange={(value) => updateCustomer({ email: value })} />
              <Field label="Address" value={invoice.customer.address} onChange={(value) => updateCustomer({ address: value })} />
            </div>
          </details>
        </FormCard>

        {isVehicle ? (
          <FormCard title="Vehicle Details">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Make" value={invoice.vehicle.make} onChange={(value) => updateVehicleWithLineItem({ make: value })} />
              <Field label="Model" value={invoice.vehicle.model} onChange={(value) => updateVehicleWithLineItem({ model: value })} />
              <Field label="Variant" value={invoice.vehicle.variant} onChange={(value) => updateVehicleWithLineItem({ variant: value })} />
              <Field label="Selling price" type="number" value={invoice.vehicle.sellingPrice} onChange={(value) => updateVehicleWithLineItem({ sellingPrice: Number(value) })} />
            </div>
            <details className="advanced-panel">
              <summary>More vehicle details <span>+</span></summary>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Year" value={invoice.vehicle.year} onChange={(value) => updateVehicleWithLineItem({ year: value })} />
                <Field label="Colour" value={invoice.vehicle.colour} onChange={(value) => updateVehicle({ colour: value })} />
                <Field label="Mileage" value={invoice.vehicle.mileage} onChange={(value) => updateVehicle({ mileage: value })} />
                <Field label="Chassis no." value={invoice.vehicle.chassisNumber} onChange={(value) => updateVehicle({ chassisNumber: value })} />
                <Field label="Engine no." value={invoice.vehicle.engineNumber} onChange={(value) => updateVehicle({ engineNumber: value })} />
                <Field label="Registration no." value={invoice.vehicle.registrationNumber} onChange={(value) => updateVehicle({ registrationNumber: value })} />
              </div>
            </details>
          </FormCard>
        ) : (
          <FormCard title="Items / Services">
            <p className="text-sm leading-6 text-graphite">Use this for accessories, service work, spare parts, admin fees, detailing, transport, booking or any custom billing.</p>
            <ItemsForm invoice={invoice} updateInvoice={updateInvoice} />
          </FormCard>
        )}

        <FormCard title="Payment Summary">
          {isVehicle ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Booking fee" type="number" value={invoice.payment.bookingFee} onChange={(value) => updatePayment({ bookingFee: Number(value) })} />
              <Field label="Deposit" type="number" value={invoice.payment.deposit} onChange={(value) => updatePayment({ deposit: Number(value) })} />
              <Field label="Loan amount" type="number" value={invoice.payment.loanAmount} onChange={(value) => updatePayment({ loanAmount: Number(value) })} />
              <Field label="Discount" type="number" value={invoice.payment.discount} onChange={(value) => updatePayment({ discount: Number(value) })} />
              <Field label="Trade-in" type="number" value={invoice.payment.tradeInValue} onChange={(value) => updatePayment({ tradeInValue: Number(value) })} />
              <Field label="Amount paid" type="number" value={invoice.payment.amountPaid} onChange={(value) => updatePayment({ amountPaid: Number(value) })} />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Deposit / advance" type="number" value={invoice.payment.deposit} onChange={(value) => updatePayment({ deposit: Number(value), bookingFee: 0, loanAmount: 0, tradeInValue: 0 })} />
              <Field label="Discount" type="number" value={invoice.payment.discount} onChange={(value) => updatePayment({ discount: Number(value) })} />
              <Field label="Amount paid" type="number" value={invoice.payment.amountPaid} onChange={(value) => updatePayment({ amountPaid: Number(value), loanAmount: 0 })} />
            </div>
          )}
          <details className="advanced-panel" open={!isVehicle}>
            <summary>Extra charges, tax and line items <span>+</span></summary>
            <PaymentForm invoice={invoice} updateInvoice={updateInvoice} />
            <div className="mt-3">
              {isVehicle && <button className="border border-black/10 px-4 py-2 text-sm font-bold" onClick={syncItems}>Sync line items from car/payment</button>}
            </div>
            {isVehicle && <ItemsForm invoice={invoice} updateInvoice={updateInvoice} />}
          </details>
        </FormCard>

        <FormCard title="Notes">
          <TextArea label="Customer note" value={invoice.notes} onChange={(value) => updateInvoice({ notes: value })} />
          <details className="advanced-panel">
            <summary>Terms & conditions <span>+</span></summary>
            <div className="mt-3">
              <TextArea label="Terms" value={invoice.terms} onChange={(value) => updateInvoice({ terms: value })} />
            </div>
          </details>
        </FormCard>
      </div>
      <div className="space-y-4">
        <ActionBar saveInvoice={saveInvoice} printInvoice={printInvoice} />
        <InvoicePreview invoice={invoice} compact />
      </div>
    </div>
  );
}

function PaymentForm({ invoice, updateInvoice }: any) {
  const fields = [
    ["processingFee", "Processing Fee"], ["roadTax", "Road Tax"], ["insurance", "Insurance"], ["jpjFee", "JPJ / Registration Fee"], ["otherCharges", "Other Charges"]
  ];
  return (
    <div className="mt-3 border-t border-black/10 pt-3">
      <div className="grid gap-3 md:grid-cols-3">
        {fields.map(([key, label]) => <Field key={key} label={label} type="number" value={invoice.payment[key]} onChange={(value) => updateInvoice({ payment: { ...invoice.payment, [key]: Number(value) } })} />)}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex h-11 items-center gap-3 rounded-md border border-black/10 bg-mist px-3 text-sm">
          <input type="checkbox" checked={invoice.payment.sstEnabled} onChange={(event) => updateInvoice({ payment: { ...invoice.payment, sstEnabled: event.target.checked } })} />
          Enable SST / Tax
        </label>
        <Field label="SST rate (%)" type="number" value={invoice.payment.sstRate} onChange={(value) => updateInvoice({ payment: { ...invoice.payment, sstRate: Number(value) } })} />
      </div>
    </div>
  );
}

function ItemsForm({ invoice, updateInvoice }: any) {
  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    updateInvoice({ items: invoice.items.map((item: InvoiceItem) => (item.id === id ? { ...item, ...patch } : item)) });
  };
  return (
    <div className="mt-4 border-t border-black/10 pt-4">
      <h3 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-ink">Line items</h3>
      <div className="space-y-3">
        {invoice.items.map((item: InvoiceItem) => (
          <div key={item.id} className="grid gap-2 border border-black/10 bg-mist p-3 md:grid-cols-[1fr_90px_130px_42px]">
            <input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Description" className="h-10 border border-black/10 bg-white px-3 text-sm outline-none focus:border-gold" />
            <input type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} className="h-10 border border-black/10 bg-white px-3 text-sm outline-none focus:border-gold" />
            <input type="number" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: Number(event.target.value) })} className="h-10 border border-black/10 bg-white px-3 text-sm outline-none focus:border-gold" />
            <button className="grid h-10 place-items-center border border-black/10 bg-white" onClick={() => updateInvoice({ items: invoice.items.filter((next: InvoiceItem) => next.id !== item.id) })} aria-label="Remove item">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <button className="mt-2 flex items-center gap-2 border border-black/10 px-4 py-2 text-sm font-bold" onClick={() => updateInvoice({ items: [...invoice.items, { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }] })}>
        <Plus size={16} />
        Add charge
      </button>
    </div>
  );
}

function ActionBar({ saveInvoice, printInvoice }: any) {
  return (
    <div className="no-print sticky top-[78px] z-10 flex flex-wrap justify-end gap-3 border border-black/10 bg-white/92 p-3 shadow-soft backdrop-blur">
      <button onClick={saveInvoice} className="flex items-center gap-2 border border-black/10 px-4 py-2 text-sm font-bold">
        <Save size={16} />
        Save
      </button>
      <button onClick={printInvoice} className="flex items-center gap-2 bg-gold px-4 py-2 text-sm font-extrabold text-white">
        <Download size={16} />
        Export PDF / Print
      </button>
    </div>
  );
}

function PreviewPage({ invoice, saveInvoice, printInvoice }: any) {
  return (
    <div className="space-y-4">
      <ActionBar saveInvoice={saveInvoice} printInvoice={printInvoice} />
      <InvoicePreview invoice={invoice} />
    </div>
  );
}

function InvoicePreview({ invoice, compact = false }: { invoice: Invoice; compact?: boolean }) {
  const total = calculateInvoice(invoice);
  const invoiceType = invoice.invoiceType ?? "Vehicle Sale";
  const isVehicle = invoiceType === "Vehicle Sale";
  return (
    <article className={clsx("print-area mx-auto bg-white text-ink shadow-premium", compact ? "border border-black/10 p-6" : "min-h-[297mm] w-full max-w-[210mm] p-8")}>
      <header className="flex flex-col justify-between gap-6 border-b-4 border-ink pb-6 sm:flex-row">
        <div className="flex gap-4">
          <div className="grid h-16 w-16 shrink-0 -skew-x-6 place-items-center border border-gold bg-ink text-lg font-black text-gold">IA</div>
          <div>
            <h2 className="text-xl font-black tracking-tight">{invoice.company.name}</h2>
            <p className="mt-1 text-xs text-graphite">{invoice.company.registrationNumber}</p>
            <p className="mt-2 max-w-sm text-sm text-graphite">{invoice.company.address}</p>
            <p className="mt-2 text-sm text-graphite">{invoice.company.phone} / {invoice.company.email}</p>
            <p className="text-sm text-graphite">{invoice.company.website}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gold">{invoiceType}</p>
          <p className="mt-2 text-3xl font-black tracking-tight">{invoice.invoiceNumber}</p>
          <StatusBadge status={invoice.status} />
          <p className="mt-4 text-sm text-graphite">Date: {invoice.invoiceDate || "-"}</p>
          <p className="text-sm text-graphite">Due: {invoice.dueDate || "-"}</p>
        </div>
      </header>

      <section className={clsx("grid gap-5 border-b border-black/10 py-6", isVehicle && "md:grid-cols-2")}>
        <InfoBlock title="Customer Details" rows={[["Name", invoice.customer.fullName], ["IC / Passport", invoice.customer.idNumber], ["Phone", invoice.customer.phone], ["Email", invoice.customer.email], ["Address", invoice.customer.address]]} />
        {isVehicle && <InfoBlock title="Vehicle Details" rows={[["Vehicle", `${invoice.vehicle.year} ${invoice.vehicle.make} ${invoice.vehicle.model}`], ["Variant", invoice.vehicle.variant], ["Colour", invoice.vehicle.colour], ["Chassis No.", invoice.vehicle.chassisNumber], ["Engine No.", invoice.vehicle.engineNumber], ["Registration", invoice.vehicle.registrationNumber], ["Mileage", invoice.vehicle.mileage]]} />}
      </section>

      <section className="py-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-graphite">Itemized Charges</h3>
        <div className="mt-3 overflow-hidden border border-black/10">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-ink text-white">
              <tr>
                <th className="p-3 text-left font-medium">Description</th>
                <th className="p-3 text-right font-medium">Qty</th>
                <th className="p-3 text-right font-medium">Unit Price</th>
                <th className="p-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr key={item.id} className="border-t border-black/10">
                  <td className="p-3">{item.description || "-"}</td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3 text-right">{money(item.unitPrice)}</td>
                  <td className="p-3 text-right font-medium">{money(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-[1fr_330px]">
        <div className="space-y-4">
          <InfoBlock title="Payment Details" rows={[["Booking Fee", money(invoice.payment.bookingFee)], ["Deposit", money(invoice.payment.deposit)], ["Loan Amount", money(invoice.payment.loanAmount)], ["Trade-in Value", money(invoice.payment.tradeInValue)], ["Amount Paid", money(total.paid)]]} />
          <div className="border border-black/10 bg-white p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-graphite">Bank Details</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-graphite">Bank</dt>
                <dd className="font-semibold">{invoice.company.bankName || "-"}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-graphite">Account No.</dt>
                <dd className="font-semibold">{invoice.company.bankAccount || "-"}</dd>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <dt className="text-graphite">Reference</dt>
                <dd className="font-semibold">{invoice.company.paymentReference || invoice.invoiceNumber}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-graphite">Notes</h3>
            <p className="mt-2 text-sm leading-6 text-graphite">{invoice.notes}</p>
          </div>
        </div>
        <div className="border border-black/10 bg-mist p-5">
          <SummaryRow label="Subtotal" value={money(total.itemSubtotal)} />
          <SummaryRow label="Charges" value={money(total.paymentCharges)} />
          <SummaryRow label="Discount" value={`-${money(invoice.payment.discount)}`} />
          <SummaryRow label="SST / Tax" value={money(total.sst)} />
          <SummaryRow label="Total Payable" value={money(total.totalPayable)} strong />
          <SummaryRow label="Amount Paid" value={money(total.paid + invoice.payment.loanAmount)} />
          <div className="mt-4 border-t border-black/10 pt-4">
            <SummaryRow label="Balance Due" value={money(total.balance)} strong gold />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 border-t border-black/10 pt-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-graphite">Terms & Conditions</h3>
          <p className="mt-2 text-sm leading-6 text-graphite">{invoice.terms}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid min-h-32 place-items-center rounded-md border border-dashed border-black/20 text-center text-xs text-graphite">Company stamp</div>
          <div className="flex min-h-32 flex-col justify-end rounded-md border border-black/10 p-4">
            <div className="border-t border-black/30 pt-3 text-center text-xs font-medium text-graphite">Authorised Signature</div>
          </div>
        </div>
      </section>
    </article>
  );
}

function History({ invoices, query, setQuery, filter, setFilter, editInvoice, confirmDelete }: any) {
  return (
    <div className="space-y-5">
      <SearchBar query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
      <InvoiceTable invoices={invoices} editInvoice={editInvoice} confirmDelete={confirmDelete} />
    </div>
  );
}

function InvoiceTable({ invoices, editInvoice, confirmDelete }: any) {
  if (!invoices.length) {
    return <div className="border border-dashed border-black/20 bg-white p-12 text-center shadow-soft"><div className="mx-auto grid h-14 w-14 place-items-center bg-mist text-gold"><FileText /></div><h2 className="mt-4 text-xl font-black">No invoices found</h2><p className="mt-2 text-sm text-graphite">Create a vehicle sale invoice or custom invoice to start the history.</p></div>;
  }
  return (
    <div className="overflow-hidden border border-black/10 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-ink text-left text-xs uppercase tracking-[0.14em] text-white/65">
            <tr><th className="p-4">Invoice</th><th className="p-4">Customer</th><th className="p-4">Type</th><th className="p-4">Details</th><th className="p-4">Status</th><th className="p-4 text-right">Balance</th><th className="p-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {invoices.map((invoice: Invoice) => {
              const total = calculateInvoice(invoice);
              const invoiceType = invoice.invoiceType ?? "Vehicle Sale";
              const detail = invoiceType === "Vehicle Sale" ? `${invoice.vehicle.make} ${invoice.vehicle.model}`.trim() : invoice.items[0]?.description;
              return (
                <tr key={invoice.id} className="border-t border-black/10 transition hover:bg-mist/70">
                  <td className="p-4 font-semibold">{invoice.invoiceNumber}<p className="text-xs font-normal text-graphite">{invoice.invoiceDate}</p></td>
                  <td className="p-4">{invoice.customer.fullName || "Unnamed customer"}<p className="text-xs text-graphite">{invoice.customer.phone}</p></td>
                  <td className="p-4"><span className="border border-black/10 bg-white px-2 py-1 text-xs font-bold">{invoiceType}</span></td>
                  <td className="p-4">{detail || "Custom items"}<p className="text-xs text-graphite">{invoiceType === "Vehicle Sale" ? invoice.vehicle.variant : `${invoice.items.length} line item(s)`}</p></td>
                  <td className="p-4"><StatusBadge status={invoice.status} /></td>
                  <td className="p-4 text-right font-semibold">{money(total.balance)}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => editInvoice(invoice)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10" aria-label="Edit invoice"><Edit3 size={15} /></button>
                      {confirmDelete && <button onClick={() => confirmDelete(invoice)} className="grid h-9 w-9 place-items-center rounded-md border border-black/10" aria-label="Delete invoice"><Trash2 size={15} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPage({ company, setCompany, notify }: any) {
  const fields = [["name", "Company Name"], ["registrationNumber", "Registration Number"], ["address", "Address"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"], ["bankName", "Bank Name"], ["bankAccount", "Bank Account"], ["paymentReference", "Payment Reference"]];
  return (
    <FormCard title="Company Settings">
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map(([key, label]) => <Field key={key} label={label} value={company[key]} onChange={(value) => setCompany({ ...company, [key]: value })} />)}
      </div>
      <button onClick={() => notify("Company settings saved")} className="mt-4 flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"><Save size={16} />Save settings</button>
    </FormCard>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border border-black/10 bg-white p-5 shadow-soft sm:p-6"><h2 className="mb-4 text-base font-black uppercase tracking-[0.12em] text-ink">{title}</h2><div className="space-y-3">{children}</div></section>;
}

function SegmentedControl({ value, options, onChange }: { value: InvoiceType; options: InvoiceType[]; onChange: (value: InvoiceType) => void }) {
  return (
    <div className="mb-4 grid gap-2 border border-black/10 bg-mist p-1 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={clsx(
            "px-4 py-3 text-sm font-black transition",
            value === option ? "bg-ink text-white shadow-soft" : "text-graphite hover:bg-white hover:text-ink"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  const id = useId();
  return <div className="block"><label htmlFor={id} className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-graphite">{label}</label><input id={id} type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="h-12 w-full border border-black/10 bg-mist px-3 text-sm font-semibold outline-none transition focus:border-gold focus:bg-white" /></div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="block"><label htmlFor={id} className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-graphite">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full border border-black/10 bg-mist px-3 text-sm font-semibold outline-none transition focus:border-gold focus:bg-white">{options.map((option: string) => <option key={option}>{option}</option>)}</select></div>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="block"><label htmlFor={id} className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-graphite">{label}</label><textarea id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full border border-black/10 bg-mist px-3 py-3 text-sm font-medium outline-none transition focus:border-gold focus:bg-white" /></div>;
}

function GridFields({ data, update, fields }: any) {
  return <div className="grid gap-3 md:grid-cols-2">{fields.map(([key, label, type]: any) => <Field key={key} label={label} type={type} value={data[key]} onChange={(value: string) => update({ ...data, [key]: type === "number" ? Number(value) : value })} />)}</div>;
}

function InfoBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return <div><h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-graphite">{title}</h3><dl className="mt-3 space-y-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3 text-sm"><dt className="text-graphite">{label}</dt><dd className="font-medium">{value || "-"}</dd></div>)}</dl></div>;
}

function SummaryRow({ label, value, strong = false, gold = false }: any) {
  return <div className={clsx("flex justify-between gap-4 py-1 text-sm", strong && "text-base font-bold", gold && "text-gold")}><span>{label}</span><span>{value}</span></div>;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const style = { Draft: "bg-silver text-ink", Pending: "bg-gold/20 text-[#7a5a22]", Paid: "bg-emerald-100 text-emerald-700", Cancelled: "bg-red-100 text-red-700" }[status];
  return <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", style)}>{status}</span>;
}
