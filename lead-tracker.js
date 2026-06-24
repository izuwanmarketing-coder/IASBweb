(function () {
  const db = window.IASBData?.client;
  const sessionKey = "iasb_lead_session";
  const sessionId = localStorage.getItem(sessionKey) || crypto.randomUUID?.() || String(Date.now());
  localStorage.setItem(sessionKey, sessionId);

  function pageName() {
    const path = location.pathname.split("/").pop() || "index.html";
    return path.replace(".html", "") || "home";
  }

  function normalizeText(value) {
    return String(value || "").trim().slice(0, 220);
  }

  async function track(action, payload = {}) {
    if (!db) return;
    try {
      await db.from("lead_events").insert({
        session_id: sessionId,
        page: pageName(),
        action: normalizeText(action),
        label: normalizeText(payload.label),
        car_id: payload.car_id || null,
        car_name: normalizeText(payload.car_name),
        source_url: location.href,
        user_agent: navigator.userAgent.slice(0, 280),
        metadata: payload.metadata || {}
      });
    } catch (error) {
      console.warn("Lead tracking skipped.", error);
    }
  }

  document.addEventListener("click", event => {
    const target = event.target.closest("[data-lead-action], a[href*='wa.me'], a[href*='whatsapp'], a[href*='calculator.html'], a[href*='contact.html']");
    if (!target) return;
    const action = target.dataset.leadAction || (
      target.href?.includes("wa.me") ? "whatsapp_click" :
      target.href?.includes("calculator.html") ? "calculator_click" :
      target.href?.includes("contact.html") ? "contact_click" :
      "cta_click"
    );
    track(action, {
      label: target.dataset.leadLabel || target.textContent,
      car_id: target.dataset.carId || null,
      car_name: target.dataset.carName || ""
    });
  }, { capture: true });

  window.IASBLeadTracker = { track };
})();
