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

  function summary() {
    return `IZUWAN AUTOMOBILE - TRANSACTION BREAKDOWN

Model: ${$("vehicleName").value.trim() || "Belum ditetapkan"}
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

  fieldIds.forEach(id => $(id).addEventListener("input", calculate));
  $("otrCopyButton").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary());
      showToast("Breakdown OTR disalin");
    } catch {
      showToast("Tidak dapat menyalin");
    }
  });
  $("otrWhatsappButton").addEventListener("click", () => {
    const number = salesmen.length ? $("salesmanSelect").value : "";
    window.open(window.IASBSite.whatsappUrl(summary(), number), "_blank", "noopener");
  });
  $("printQuotationButton").addEventListener("click", () => window.print());

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
  });

  const params = new URLSearchParams(location.search);
  if (params.has("price")) {
    $("otrSellingPrice").value = Number(params.get("price")) || 0;
    $("otrLoanAmount").value = Math.round((Number(params.get("price")) || 0) * 0.9);
  }
  if (params.has("car")) $("vehicleName").value = params.get("car");
  calculate();
})();
