(function () {
  const form = document.getElementById("finderForm");
  const result = document.getElementById("finderResult");
  if (!form || !result) return;

  const modelMap = {
    "Family / balik kampung": {
      title: "Family comfort shortlist",
      models: ["Toyota Alphard", "Toyota Vellfire", "Nissan Elgrand"],
      reason: "Pilihan MPV premium yang selesa untuk family, long distance dan penggunaan harian."
    },
    "Executive / business": {
      title: "Executive premium shortlist",
      models: ["Toyota Alphard Executive Lounge", "Toyota Crown", "Lexus LM"],
      reason: "Kereta yang nampak kemas, selesa untuk business dan sesuai untuk chauffeur-driven feel."
    },
    "Daily SUV": {
      title: "Daily SUV shortlist",
      models: ["Toyota Harrier", "Toyota Prado", "Lexus NX"],
      reason: "SUV recond yang practical untuk daily drive, family kecil dan road presence yang lebih confident."
    },
    "Performance / enthusiast": {
      title: "Enthusiast shortlist",
      models: ["Toyota GR", "Nissan Skyline", "Lexus performance selection"],
      reason: "Fokus kepada spec, condition, mileage dan rarity — sesuai kalau anda mencari unit lebih special."
    }
  };

  function safeText(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function selectedUsage() {
    return form.querySelector("input[name='usage']:checked")?.value || "Family / balik kampung";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const usage = selectedUsage();
    const match = modelMap[usage] || modelMap["Family / balik kampung"];
    const budget = document.getElementById("finderBudget").selectedOptions[0].textContent;
    const urgency = document.getElementById("finderUrgency").value;
    const seats = document.getElementById("finderSeats").value;
    const preference = document.getElementById("finderPreference").value.trim() || "Open to suggestion";
    const message = `[Find My Car Wizard] Hai Izuwan, saya nak bantuan pilih kereta.\n\nBudget: ${budget}\nUsage: ${usage}\nSeats: ${seats}\nPreference: ${preference}\nUrgency: ${urgency}\n\nCadangan awal: ${match.models.join(", ")}.\nBoleh advisor suggest unit ready stock atau incoming yang sesuai?`;

    result.innerHTML = `<span class="eyebrow">MATCH RESULT</span>
      <h2>${safeText(match.title)}</h2>
      <p>${safeText(match.reason)}</p>
      <div class="finder-models">${match.models.map(model => `<span>${safeText(model)}</span>`).join("")}</div>
      <div class="finder-summary">
        <div><b>Budget</b><span>${safeText(budget)}</span></div>
        <div><b>Seats</b><span>${safeText(seats)}</span></div>
        <div><b>Urgency</b><span>${safeText(urgency)}</span></div>
      </div>
      <div class="finder-actions">
        <a href="${window.IASBSite.whatsappUrl(message)}" data-lead-action="finder_whatsapp" data-lead-label="${safeText(match.title)}" target="_blank" rel="noopener">WhatsApp advisor</a>
        <a class="outline" href="inventory.html">Browse inventory</a>
      </div>`;

    window.IASBLeadTracker?.track("finder_completed", {
      label: match.title,
      metadata: { budget, usage, seats, preference, urgency, models: match.models }
    });
  });
})();
