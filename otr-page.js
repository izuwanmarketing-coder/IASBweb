(function () {
  const $ = id => document.getElementById(id);
  const fieldIds = ["otrSellingPrice", "otrRoadtax", "otrRegistration", "otrProcessing", "otrWarranty", "otrInsurance", "otrNcd", "otrWindscreen", "otrLoanAmount", "otrBooking", "otrDownpaymentPaid"];
  let salesmen = [];

  const value = id => Math.max(0, Number($(id).value) || 0);
  const money = number => `RM ${Math.round(number || 0).toLocaleString("en-MY")}`;

  function calculate() {
    const selling = value("otrSellingPrice");
    const roadtax = value("otrRoadtax");
    const registration = value("otrRegistration");
    const processing = value("otrProcessing");
    const warranty = value("otrWarranty");
    const insurance = value("otrInsurance");
    const windscreen = value("otrWindscreen");
    const loan = value("otrLoanAmount");
    const booking = value("otrBooking");
    const paid = value("otrDownpaymentPaid");
    const total = selling + roadtax + registration + processing + warranty + insurance + windscreen;
    const payable = Math.max(0, total - loan);
    const balance = Math.max(0, payable - booking - paid);

    $("otrTotal").textContent = money(total);
    $("otrLineSelling").textContent = money(selling);
    $("otrLineRoadtax").textContent = money(roadtax);
    $("otrLineRegistration").textContent = money(registration);
    $("otrLineProcessingWarranty").textContent = money(processing + warranty);
    $("otrLineInsurance").textContent = money(insurance);
    $("otrLineWindscreen").textContent = money(windscreen);
    $("otrNcdLabel").textContent = `(NCD ${$("otrNcd").value}%)`;
    $("otrPayable").textContent = money(payable);
    $("otrBalance").textContent = money(balance);
  }

  function updateExportState() {
    const hasModel = Boolean($("vehicleName").value.trim());
    const hasPrice = value("otrSellingPrice") > 0;
    const valid = hasModel && hasPrice;
    ["otrWhatsappButton", "otrCopyButton", "printQuotationButton"].forEach(id => {
      $(id).disabled = !valid;
    });
    const hasStarted = hasModel || hasPrice;
    $("vehicleName").setAttribute("aria-invalid", String(hasStarted && !hasModel));
    $("otrSellingPrice").setAttribute("aria-invalid", String(hasStarted && !hasPrice));
    $("quotationFormStatus").textContent = valid
      ? "Quotation sedia untuk disemak, dikongsi atau disimpan sebagai PDF."
      : `Masukkan ${!hasModel && !hasPrice ? "model dan selling price" : !hasModel ? "model" : "selling price"} untuk aktifkan quotation.`;
    $("quotationFormStatus").classList.toggle("ready", valid);
    return valid;
  }

  function summary() {
    return `IZUWAN AUTOMOBILE - TRANSACTION BREAKDOWN

Model: ${$("vehicleName").value.trim() || "Belum ditetapkan"}
Pelanggan: ${$("customerName").value.trim() || "Belum ditetapkan"}
Telefon: ${$("customerPhone").value.trim() || "Belum ditetapkan"}
Selling price: ${$("otrLineSelling").textContent}
Roadtax: ${$("otrLineRoadtax").textContent}
Registration / ownership: ${$("otrLineRegistration").textContent}
Processing & warranty: ${$("otrLineProcessingWarranty").textContent}
Insurance (NCD ${$("otrNcd").value}%): ${$("otrLineInsurance").textContent}
Windscreen cover: ${$("otrLineWindscreen").textContent}

OTR price: ${$("otrTotal").textContent}
Loan amount: ${money(value("otrLoanAmount"))}
Total payable: ${$("otrPayable").textContent}
Booking paid: ${money(value("otrBooking"))}
Downpayment paid: ${money(value("otrDownpaymentPaid"))}
Balance downpayment: ${$("otrBalance").textContent}

*Anggaran awal. Insurance, warranty dan roadtax perlu disahkan.`;
  }

  function showToast(text) {
    const toast = $("toast");
    toast.textContent = text;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function pdfFilename(model, date) {
    const safeModel = model
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 45);
    return `QUOTATION-${safeModel || "VEHICLE"}-${date}.pdf`;
  }

  function saveQuotationPdf() {
    if (!updateExportState()) {
      showToast("Lengkapkan model dan selling price dahulu.");
      return;
    }
    const JsPdf = window.jspdf?.jsPDF;
    if (!JsPdf) {
      showToast("PDF generator belum tersedia. Sila cuba lagi.");
      return;
    }

    calculate();
    const doc = new JsPdf({ unit: "mm", format: "a4" });
    const model = $("vehicleName").value.trim() || "Vehicle not specified";
    const customerName = $("customerName").value.trim() || "Not specified";
    const customerPhone = $("customerPhone").value.trim() || "";
    const now = new Date();
    const dateCode = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("");
    const reference = `IA-${dateCode}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const company = window.IASBSite?.settings?.company_name || "Izuwan Automobile";
    const selectedSalesman = salesmen.length
      ? salesmen.find(person => person.whatsapp === $("salesmanSelect").value)
      : null;
    const rows = [
      ["Selling price", money(value("otrSellingPrice"))],
      ["Roadtax", money(value("otrRoadtax"))],
      ["Registration / ownership", money(value("otrRegistration"))],
      ["Processing fee", money(value("otrProcessing"))],
      ["Warranty", money(value("otrWarranty"))],
      [`Insurance (NCD ${$("otrNcd").value}%)`, money(value("otrInsurance"))],
      ["Windscreen cover", money(value("otrWindscreen"))]
    ];

    doc.setFillColor(226, 27, 35);
    doc.rect(0, 0, 210, 45, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(company.toUpperCase(), 16, 19);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("JAPAN RECONDITIONED CAR SPECIALIST", 16, 27);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.text("QUOTATION", 194, 20, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Reference: ${reference}`, 194, 28, { align: "right" });
    doc.text(`Date: ${now.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}`, 194, 34, { align: "right" });

    doc.setTextColor(25, 25, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text("VEHICLE / MODEL", 16, 58);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(doc.splitTextToSize(model, 92), 16, 66);
    doc.setTextColor(110, 110, 110);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("PREPARED FOR", 116, 58);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(customerName, 78), 116, 66);
    if (customerPhone) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(customerPhone, 116, 72);
    }

    let y = 82;
    doc.setFillColor(245, 245, 245);
    doc.rect(16, y - 7, 178, 10, "F");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text("TRANSACTION BREAKDOWN", 20, y);
    y += 10;
    rows.forEach(([label, amount]) => {
      doc.setDrawColor(224, 224, 224);
      doc.line(16, y + 4, 194, y + 4);
      doc.setTextColor(65, 65, 65);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(label, 20, y);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(amount, 190, y, { align: "right" });
      y += 9;
    });

    doc.setFillColor(20, 20, 20);
    doc.rect(16, y, 178, 17, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text("TOTAL ON-THE-ROAD PRICE", 20, y + 7);
    doc.setFontSize(15);
    doc.text($("otrTotal").textContent, 190, y + 11, { align: "right" });
    y += 27;

    const paymentRows = [
      ["Loan amount", money(value("otrLoanAmount"))],
      ["Total payable (downpayment)", $("otrPayable").textContent],
      ["Booking paid", money(value("otrBooking"))],
      ["Downpayment paid", money(value("otrDownpaymentPaid"))]
    ];
    doc.setTextColor(90, 90, 90);
    doc.setFontSize(8);
    doc.text("PAYMENT SUMMARY", 16, y);
    y += 9;
    paymentRows.forEach(([label, amount]) => {
      doc.setTextColor(70, 70, 70);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(label, 20, y);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.text(amount, 190, y, { align: "right" });
      y += 9;
    });

    doc.setFillColor(226, 27, 35);
    doc.rect(16, y, 178, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BALANCE DOWNPAYMENT", 20, y + 10);
    doc.setFontSize(14);
    doc.text($("otrBalance").textContent, 190, y + 10, { align: "right" });
    y += 29;

    if (selectedSalesman) {
      doc.setTextColor(90, 90, 90);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("PREPARED BY", 16, y);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(selectedSalesman.name, 16, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text([selectedSalesman.role, selectedSalesman.branch, selectedSalesman.whatsapp].filter(Boolean).join(" | "), 16, y + 13);
    }

    doc.setDrawColor(220, 220, 220);
    doc.line(16, 272, 194, 272);
    doc.setTextColor(105, 105, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("This quotation is an initial estimate only. Insurance, warranty, roadtax and financing are subject to final confirmation.", 16, 279);
    doc.text(`${company}  |  izuwanautomobile.com`, 16, 286);
    doc.save(pdfFilename(model, dateCode));
    showToast("Quotation PDF disimpan");
  }

  fieldIds.forEach(id => $(id).addEventListener("input", () => {
    calculate();
    updateExportState();
  }));
  $("vehicleName").addEventListener("input", updateExportState);
  $("otrCopyButton").addEventListener("click", async () => {
    if (!updateExportState()) return;
    try {
      await navigator.clipboard.writeText(summary());
      showToast("Breakdown OTR disalin");
    } catch {
      showToast("Tidak dapat menyalin");
    }
  });
  $("otrWhatsappButton").addEventListener("click", () => {
    if (!updateExportState()) return;
    const number = salesmen.length ? $("salesmanSelect").value : "";
    window.open(window.IASBSite.whatsappUrl(summary(), number), "_blank", "noopener");
  });
  $("printQuotationButton").addEventListener("click", saveQuotationPdf);

  window.addEventListener("iasb:data", event => {
    const settings = event.detail.settings;
    salesmen = event.detail.salesmen || [];
    if (settings) {
      $("otrProcessing").value = Number(settings.processing_fee) || 0;
      $("otrRegistration").value = Number(settings.registration_fee) || 0;
    }
    if (salesmen.length) {
      $("salesmanSelect").innerHTML = salesmen.map(person =>
        `<option value="${person.whatsapp}">${person.name}${person.branch ? ` · ${person.branch}` : ""}</option>`
      ).join("");
      $("salesmanField").classList.remove("hidden");
    }
    calculate();
    updateExportState();
  });

  const params = new URLSearchParams(location.search);
  if (params.has("price")) {
    $("otrSellingPrice").value = Number(params.get("price")) || 0;
    $("otrLoanAmount").value = Math.round((Number(params.get("price")) || 0) * 0.9);
  }
  if (params.has("car")) $("vehicleName").value = params.get("car");
  calculate();
  updateExportState();
})();
