export type InvoiceStatus = "Draft" | "Pending" | "Paid" | "Cancelled";
export type InvoiceType = "Vehicle Sale" | "Custom Invoice";

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type CompanySettings = {
  name: string;
  registrationNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccount: string;
  paymentReference: string;
};

export type Invoice = {
  id: string;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  status: InvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  customer: {
    fullName: string;
    idNumber: string;
    phone: string;
    email: string;
    address: string;
  };
  vehicle: {
    make: string;
    model: string;
    variant: string;
    year: string;
    colour: string;
    chassisNumber: string;
    engineNumber: string;
    registrationNumber: string;
    mileage: string;
    sellingPrice: number;
  };
  payment: {
    bookingFee: number;
    deposit: number;
    loanAmount: number;
    tradeInValue: number;
    discount: number;
    processingFee: number;
    roadTax: number;
    insurance: number;
    jpjFee: number;
    otherCharges: number;
    amountPaid: number;
    sstEnabled: boolean;
    sstRate: number;
  };
  items: InvoiceItem[];
  notes: string;
  terms: string;
  company: CompanySettings;
  updatedAt: string;
};

export const defaultCompany: CompanySettings = {
  name: "Izuwan Automobile Sdn. Bhd.",
  registrationNumber: "Registration Number",
  address: "Company address, Malaysia",
  phone: "019-278 8667",
  email: "sales@izuwanautomobile.com",
  website: "izuwanautomobile.com",
  bankName: "Bank Name",
  bankAccount: "Account Number",
  paymentReference: "Use invoice number as payment reference"
};

export const money = (value: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);

export const today = () => new Date().toISOString().slice(0, 10);

export const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const makeInvoiceNumber = (count: number) => {
  const year = new Date().getFullYear();
  return `IZW-${year}-${String(count + 1).padStart(4, "0")}`;
};

export const blankInvoice = (count = 0, company = defaultCompany): Invoice => ({
  id: crypto.randomUUID(),
  invoiceType: "Vehicle Sale",
  invoiceNumber: makeInvoiceNumber(count),
  status: "Draft",
  invoiceDate: today(),
  dueDate: addDays(7),
  customer: {
    fullName: "",
    idNumber: "",
    phone: "",
    email: "",
    address: ""
  },
  vehicle: {
    make: "",
    model: "",
    variant: "",
    year: "",
    colour: "",
    chassisNumber: "",
    engineNumber: "",
    registrationNumber: "",
    mileage: "",
    sellingPrice: 0
  },
  payment: {
    bookingFee: 0,
    deposit: 0,
    loanAmount: 0,
    tradeInValue: 0,
    discount: 0,
    processingFee: 0,
    roadTax: 0,
    insurance: 0,
    jpjFee: 0,
    otherCharges: 0,
    amountPaid: 0,
    sstEnabled: false,
    sstRate: 8
  },
  items: [
    { id: crypto.randomUUID(), description: "Vehicle selling price", quantity: 1, unitPrice: 0 },
    { id: crypto.randomUUID(), description: "JPJ / registration fee", quantity: 1, unitPrice: 0 }
  ],
  notes: "Thank you for choosing Izuwan Automobile. This invoice is prepared for the selected imported or reconditioned vehicle package.",
  terms:
    "Booking fee and deposit are subject to company approval terms. Vehicle delivery is subject to full payment clearance, financing approval, JPJ documentation, and final inspection.",
  company,
  updatedAt: new Date().toISOString()
});

export const sampleInvoices = (): Invoice[] => {
  const first = blankInvoice(0);
  first.invoiceNumber = "IZW-2026-0001";
  first.status = "Pending";
  first.customer = {
    fullName: "Aiman Hakimi",
    idNumber: "900101-10-5555",
    phone: "012-345 6789",
    email: "aiman@example.com",
    address: "Shah Alam, Selangor"
  };
  first.vehicle = {
    make: "Toyota",
    model: "Alphard",
    variant: "2.5 SC Package",
    year: "2021",
    colour: "Pearl White",
    chassisNumber: "AGH30-1234567",
    engineNumber: "2AR-7654321",
    registrationNumber: "Pending",
    mileage: "41,000 km",
    sellingPrice: 289000
  };
  first.payment = {
    ...first.payment,
    bookingFee: 3000,
    deposit: 25000,
    loanAmount: 240000,
    discount: 2000,
    processingFee: 1200,
    roadTax: 438,
    insurance: 6900,
    jpjFee: 650,
    amountPaid: 28000
  };
  first.items = [
    { id: crypto.randomUUID(), description: "Toyota Alphard 2.5 SC Package 2021", quantity: 1, unitPrice: 289000 },
    { id: crypto.randomUUID(), description: "Insurance", quantity: 1, unitPrice: 6900 },
    { id: crypto.randomUUID(), description: "Road tax", quantity: 1, unitPrice: 438 },
    { id: crypto.randomUUID(), description: "JPJ / registration fee", quantity: 1, unitPrice: 650 },
    { id: crypto.randomUUID(), description: "Processing fee", quantity: 1, unitPrice: 1200 }
  ];

  const second = blankInvoice(1);
  second.invoiceNumber = "IZW-2026-0002";
  second.invoiceType = "Custom Invoice";
  second.status = "Paid";
  second.customer.fullName = "Nur Sabrina";
  second.customer.phone = "013-888 2211";
  second.vehicle.make = "Mercedes-Benz";
  second.vehicle.model = "A200";
  second.vehicle.variant = "AMG Line UK Spec";
  second.vehicle.year = "2020";
  second.vehicle.sellingPrice = 188000;
  second.payment.amountPaid = 188000;
  second.items = [
    { id: crypto.randomUUID(), description: "Premium detailing package", quantity: 1, unitPrice: 2800 },
    { id: crypto.randomUUID(), description: "Vehicle accessories", quantity: 1, unitPrice: 4200 }
  ];
  second.payment.amountPaid = 7000;

  return [first, second];
};

export const calculateInvoice = (invoice: Invoice) => {
  const itemSubtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const paymentCharges =
    invoice.payment.processingFee +
    invoice.payment.roadTax +
    invoice.payment.insurance +
    invoice.payment.jpjFee +
    invoice.payment.otherCharges;
  const base = Math.max(itemSubtotal || invoice.vehicle.sellingPrice, 0);
  const sst = invoice.payment.sstEnabled ? ((base + paymentCharges - invoice.payment.discount) * invoice.payment.sstRate) / 100 : 0;
  const totalPayable = Math.max(base + paymentCharges + sst - invoice.payment.discount - invoice.payment.tradeInValue, 0);
  const paid = invoice.payment.amountPaid + invoice.payment.bookingFee + invoice.payment.deposit;
  const balance = Math.max(totalPayable - paid - invoice.payment.loanAmount, 0);

  return { itemSubtotal, paymentCharges, sst, totalPayable, paid, balance };
};
