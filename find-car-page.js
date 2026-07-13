(function () {
  const form = document.getElementById("finderForm");
  const result = document.getElementById("finderResult");
  if (!form || !result) return;

  const briefDirections = {
    "Family / balik kampung": {
      title: "Family comfort brief",
      reason: "Advisor akan utamakan ruang, keselesaan perjalanan jauh dan susunan tempat duduk yang sesuai."
    },
    "Executive / business": {
      title: "Executive use brief",
      reason: "Advisor akan utamakan keselesaan, presentation dan spesifikasi yang sesuai untuk urusan kerja."
    },
    "Daily SUV": {
      title: "Daily SUV brief",
      reason: "Advisor akan semak pilihan yang practical untuk kegunaan harian, ruang family dan posisi pemanduan lebih tinggi."
    },
    "Performance / enthusiast": {
      title: "Enthusiast brief",
      reason: "Advisor akan memberi perhatian kepada spesifikasi, condition, mileage dan rarity unit."
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
    const direction = briefDirections[usage] || briefDirections["Family / balik kampung"];
    const budget = document.getElementById("finderBudget").selectedOptions[0].textContent;
    const urgency = document.getElementById("finderUrgency").value;
    const seats = document.getElementById("finderSeats").value;
    const preference = document.getElementById("finderPreference").value.trim() || "Open to suggestion";
    const message = `[Find My Car Brief] Hai Izuwan, saya nak bantuan pilih kereta.\n\nBudget: ${budget}\nUsage: ${usage}\nSeats: ${seats}\nPreference: ${preference}\nUrgency: ${urgency}\n\nBoleh advisor semak ready stock, incoming atau pilihan sourcing yang betul-betul sesuai?`;

    result.innerHTML = `<span class="eyebrow">ADVISOR BRIEF READY</span>
      <h2>${safeText(direction.title)}</h2>
      <p>${safeText(direction.reason)}</p>
      <div class="finder-models"><span>${safeText(usage)}</span><span>${safeText(seats)}</span><span>${safeText(preference)}</span></div>
      <div class="finder-summary">
        <div><b>Budget</b><span>${safeText(budget)}</span></div>
        <div><b>Seats</b><span>${safeText(seats)}</span></div>
        <div><b>Urgency</b><span>${safeText(urgency)}</span></div>
      </div>
      <div class="finder-actions">
        <a href="${window.IASBSite.whatsappUrl(message)}" data-lead-action="finder_whatsapp" data-lead-label="${safeText(direction.title)}" target="_blank" rel="noopener">Send brief to advisor</a>
        <a class="outline" href="inventory.html">Browse inventory</a>
      </div>`;

    window.IASBLeadTracker?.track("finder_completed", {
      label: direction.title,
      metadata: { budget, usage, seats, preference, urgency }
    });
  });
})();
