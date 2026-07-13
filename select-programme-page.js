(function () {
  const form = document.getElementById("programmeBriefForm");
  if (!form) return;

  const value = id => document.getElementById(id).value.trim();
  const money = amount => amount ? `RM ${Math.round(Number(amount)).toLocaleString("en-MY")}` : "Open for advice";

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const model = value("briefModel");
    const variant = value("briefVariant") || "Open to suggestion";
    const year = value("briefYear") || "Open to suggestion";
    const colour = value("briefColour") || "Open to suggestion";
    const budget = money(value("briefBudget"));
    const timeline = value("briefTimeline");
    const message = `[Izuwan Select Programme]\nHai Izuwan, saya ingin semak pilihan sourcing dari Jepun.\n\nModel: ${model}\nVariant / grade: ${variant}\nTahun minimum: ${year}\nWarna: ${colour}\nBajet maksimum: ${budget}\nTarget pembelian: ${timeline}\n\nBoleh advisor semak pilihan auction yang sesuai dan terangkan langkah seterusnya?`;

    window.IASBLeadTracker?.track("select_programme_brief", {
      label: model,
      metadata: { variant, year, colour, budget, timeline }
    });
    window.open(window.IASBSite.whatsappUrl(message), "_blank", "noopener");
  });
})();
