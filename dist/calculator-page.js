(function () {
  const $ = id => document.getElementById(id);
  const fields = ["salary", "commitment", "deposit", "tenure", "dsr", "interest", "carPrice"];
  let mode = "eligibility";
  let current = {};

  const money = value => `RM ${Math.max(0, Math.round(value || 0)).toLocaleString("en-MY")}`;

  function monthlyPayment(price, depositPct, years, rate) {
    const loan = price * (1 - depositPct / 100);
    return (loan + loan * (rate / 100) * years) / (years * 12);
  }

  function calculate() {
    const salary = Number($("salary").value) || 0;
    const commitment = Number($("commitment").value) || 0;
    const deposit = Number($("deposit").value) || 0;
    const years = Number($("tenure").value) || 9;
    const dsrLimit = Number($("dsr").value) || 60;
    const rate = Number($("interest").value) || 3.2;
    const allowedTotal = salary * dsrLimit / 100;
    const monthlyBudget = Math.max(0, allowedTotal - commitment);
    const maxLoan = monthlyBudget * years * 12 / (1 + rate / 100 * years);
    const maxPrice = maxLoan / (1 - deposit / 100);
    const targetPrice = Number($("carPrice").value) || 0;
    const targetLoan = targetPrice * (1 - deposit / 100);
    const targetMonthly = monthlyPayment(targetPrice, deposit, years, rate);
    const relevantMonthly = mode === "target" ? targetMonthly : monthlyBudget;
    const relevantPrice = mode === "target" ? targetPrice : maxPrice;
    const loanAmount = mode === "target" ? targetLoan : maxLoan;
    const finalDsr = salary ? ((commitment + relevantMonthly) / salary) * 100 : 0;
    const isEligible = mode === "target" ? targetMonthly <= monthlyBudget : monthlyBudget > 0;

    current = { salary, commitment, deposit, years, dsrLimit, rate, monthlyBudget, maxPrice, targetPrice, targetMonthly, finalDsr, isEligible };
    $("dsrValue").textContent = `${dsrLimit}%`;
    $("monthlyBudget").textContent = Math.round(relevantMonthly).toLocaleString("en-MY");
    $("maxPrice").textContent = money(relevantPrice);
    $("loanAmount").textContent = money(loanAmount);
    $("finalDsr").textContent = `${Math.round(finalDsr)}%`;
    $("depositAmount").textContent = money(relevantPrice * deposit / 100);

    if (mode === "target") {
      $("mainResultLabel").textContent = "Anggaran ansuran bulanan";
      $("resultDescription").textContent = `${years} tahun · deposit ${deposit}% · kadar ${rate}% p.a.`;
      $("resultBadge").textContent = isEligible ? "BERPOTENSI LAYAK" : "MELEBIHI BAJET";
    } else {
      $("mainResultLabel").textContent = "Bajet ansuran kereta";
      $("resultDescription").textContent = `Berdasarkan DSR ${dsrLimit}% dan komitmen semasa.`;
      $("resultBadge").textContent = monthlyBudget > 0 ? "SELESA" : "SEMAK SEMULA";
    }
    $("resultBadge").classList.toggle("warning", !isEligible);
  }

  function summary() {
    if (mode === "target") {
      return `IZUWAN AUTOMOBILE - ANGGARAN KERETA

Harga kereta: ${money(current.targetPrice)}
Deposit: ${current.deposit}%
Tempoh: ${current.years} tahun
Anggaran ansuran: ${money(current.targetMonthly)}/bulan
DSR selepas kereta: ${Math.round(current.finalDsr)}%
Status awal: ${current.isEligible ? "Berpotensi layak" : "Melebihi bajet"}

*Anggaran awal sahaja. Kelulusan tertakluk kepada pihak bank, CCRIS/CTOS dan dokumen customer.`;
    }
    return `IZUWAN AUTOMOBILE - ANGGARAN KELAYAKAN

Gaji bersih: ${money(current.salary)}
Komitmen: ${money(current.commitment)}
Bajet ansuran: ${money(current.monthlyBudget)}/bulan
Anggaran harga kereta: sehingga ${money(current.maxPrice)}
Deposit: ${current.deposit}%
Tempoh: ${current.years} tahun

*Anggaran awal sahaja. Kelulusan tertakluk kepada pihak bank, CCRIS/CTOS dan dokumen customer.`;
  }

  function showToast(text) {
    const toast = $("toast");
    toast.textContent = text;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  fields.forEach(id => $(id).addEventListener("input", calculate));
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach(item => item.classList.toggle("active", item === button));
    document.querySelectorAll(".target-only").forEach(item => item.classList.toggle("hidden", mode !== "target"));
    $("formTitle").textContent = mode === "target" ? "Semak kereta pilihan customer" : "Profil kewangan customer";
    calculate();
  }));

  $("resetButton").addEventListener("click", () => {
    $("salary").value = 5000;
    $("commitment").value = 500;
    $("deposit").value = 10;
    $("tenure").value = 9;
    $("dsr").value = 60;
    $("interest").value = 3.2;
    $("carPrice").value = 120000;
    calculate();
  });

  $("copyButton").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary());
      showToast("Ringkasan disalin");
    } catch {
      showToast("Tidak dapat menyalin");
    }
  });

  $("whatsappButton").addEventListener("click", () => {
    window.open(window.IASBSite.whatsappUrl(summary()), "_blank", "noopener");
  });

  window.addEventListener("iasb:data", event => {
    const settings = event.detail.settings;
    if (!settings) return;
    $("interest").value = Number(settings.default_interest) || 3.2;
    $("dsr").value = Number(settings.default_dsr) || 60;
    calculate();
  });

  const params = new URLSearchParams(location.search);
  if (params.has("price")) {
    mode = "target";
    $("carPrice").value = Number(params.get("price")) || 120000;
    document.querySelectorAll("[data-mode]").forEach(item => item.classList.toggle("active", item.dataset.mode === "target"));
    document.querySelectorAll(".target-only").forEach(item => item.classList.remove("hidden"));
    $("formTitle").textContent = "Semak kereta pilihan customer";
    const selected = params.get("car");
    if (selected) {
      $("selectedCar").textContent = selected;
      $("selectedCar").classList.remove("hidden");
    }
  }
  calculate();
})();
