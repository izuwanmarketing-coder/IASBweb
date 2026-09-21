(function () {
  const form = document.getElementById("finderForm");
  const result = document.getElementById("finderResult");
  if (!form || !result) return;
  let inventory = [];

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

  function isLive(car) {
    return car && car.is_active !== false && !["SOLD", "BOOKED", "RESERVED"].includes(String(car.status || "").toUpperCase());
  }

  function usageMatch(car, usage) {
    const haystack = `${car.type || ""} ${car.brand || ""} ${car.model || ""} ${car.variant || ""}`.toLowerCase();
    if (usage === "Family / balik kampung") return /mpv|alphard|vellfire|voxy|noah|serena/.test(haystack);
    if (usage === "Executive / business") return /sedan|lexus|mercedes|bmw|alphard|vellfire/.test(haystack);
    if (usage === "Daily SUV") return /suv|harrier|land cruiser|prado|rx|cx-/.test(haystack);
    return /performance|coupe|convertible|amg|gr86|type r|civic/.test(haystack);
  }

  function currentMatches() {
    const usage = selectedUsage();
    const budgetValue = Number(document.getElementById("finderBudget").value);
    const monthlyCap = budgetValue >= 5000 ? Number.POSITIVE_INFINITY : budgetValue;
    const urgent = document.getElementById("finderUrgency").value === "Ready stock / urgent";
    const preference = document.getElementById("finderPreference").value.trim().toLowerCase();
    const seats = document.getElementById("finderSeats").value;
    return inventory
      .filter(isLive)
      .filter(car => !urgent || ["AVAILABLE", "DONE PAID DUTI"].includes(String(car.status || "").toUpperCase()))
      .filter(car => usageMatch(car, usage))
      .filter(car => !/^[78]/.test(seats) || /alphard|vellfire|voxy|noah|serena|odyssey|stepwgn|esquire|[78][ -]?seat/i.test(`${car.model || ""} ${car.variant || ""}`))
      .map(car => {
        const monthly = window.IASBSite.monthlyEstimate(car.price);
        const text = `${car.brand || ""} ${car.model || ""} ${car.variant || ""}`.toLowerCase();
        const score = (preference && text.includes(preference) ? 8 : 0) + (String(car.status || "").toUpperCase() === "AVAILABLE" ? 2 : 0);
        return { car, monthly, score };
      })
      .filter(item => item.monthly > 0 && item.monthly <= monthlyCap)
      .sort((a, b) => b.score - a.score || a.monthly - b.monthly);
  }

  function updateLiveCount() {
    const liveCount = document.getElementById("finderLiveCount");
    if (!liveCount) return;
    if (!inventory.length) {
      liveCount.textContent = "Inventory sedang dimuatkan. Anda masih boleh sediakan brief.";
      return;
    }
    const matches = currentMatches();
    liveCount.textContent = matches.length
      ? `${matches.length} unit dalam julat bajet anda sekarang.`
      : "Tiada padanan tepat sekarang. Kami akan tunjuk pilihan terdekat atau carian Jepun.";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const usage = selectedUsage();
    const direction = briefDirections[usage] || briefDirections["Family / balik kampung"];
    const budget = document.getElementById("finderBudget").selectedOptions[0].textContent;
    const urgency = document.getElementById("finderUrgency").value;
    const seats = document.getElementById("finderSeats").value;
    const preference = document.getElementById("finderPreference").value.trim() || "Open to suggestion";
    const matches = currentMatches();
    const message = `[Find My Car Brief] Hai Izuwan, saya nak bantuan pilih kereta.\n\nBudget: ${budget}\nUsage: ${usage}\nSeats: ${seats}\nPreference: ${preference}\nUrgency: ${urgency}\n\nBoleh advisor semak ready stock, incoming atau pilihan sourcing yang betul-betul sesuai?`;

    const cards = matches.slice(0, 3).map(item => window.IASBCards.renderCard(item.car, { hrefBase: "car.html" })).join("");
    const nearest = !matches.length ? inventory.filter(isLive).map(car => ({ car, monthly: window.IASBSite.monthlyEstimate(car.price) })).filter(item => item.monthly > 0).sort((a, b) => a.monthly - b.monthly).slice(0, 2) : [];
    const nearestCards = nearest.map(item => window.IASBCards.renderCard(item.car, { hrefBase: "car.html" })).join("");
    result.innerHTML = `<span class="eyebrow">BRIEF DAN PADANAN</span>
      <h2>${safeText(direction.title)}</h2>
      <p>${safeText(direction.reason)}</p>
      <div class="finder-models"><span>${safeText(usage)}</span><span>${safeText(seats)}</span><span>${safeText(preference)}</span></div>
      <div class="finder-summary">
        <div><b>Budget</b><span>${safeText(budget)}</span></div>
        <div><b>Seats</b><span>${safeText(seats)}</span></div>
        <div><b>Urgency</b><span>${safeText(urgency)}</span></div>
      </div>
      <section class="finder-live-results" aria-labelledby="finderMatchesTitle">
        <h3 id="finderMatchesTitle">${matches.length ? `${matches.length} padanan dalam stok semasa` : "Belum ada padanan tepat"}</h3>
        <p>${matches.length ? "Unit ini memenuhi bajet dahulu, kemudian disusun mengikut kegunaan dan status." : "Dua unit terdekat ditunjukkan sebagai rujukan. Izuwan Select boleh mencari spesifikasi yang lebih tepat dari Jepun."}</p>
        <div class="finder-match-grid">${cards || nearestCards}</div>
        ${matches.length ? "" : '<a class="finder-select-handoff" href="select-programme.html">Bina brief Izuwan Select</a>'}
      </section>
      <div class="finder-actions">
        <a href="${window.IASBSite.whatsappUrl(message)}" data-lead-action="finder_whatsapp" data-lead-label="${safeText(direction.title)}" target="_blank" rel="noopener">Hantar brief kepada advisor</a>
        <a class="outline" href="inventory.html">Buka semua inventory</a>
      </div>`;

    window.IASBLeadTracker?.track("finder_completed", {
      label: direction.title,
      metadata: { budget, usage, seats, preference, urgency, matched_count: matches.length }
    });
  });

  form.addEventListener("input", updateLiveCount);
  form.addEventListener("change", updateLiveCount);
  window.addEventListener("iasb:data", event => {
    inventory = event.detail.inventory || [];
    updateLiveCount();
  });
  window.addEventListener("iasb:error", updateLiveCount);
})();
