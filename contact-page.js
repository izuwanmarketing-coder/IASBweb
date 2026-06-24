(function () {
  const grid = document.getElementById("teamGrid");
  if (!grid) return;

  const initials = name => String(name || "IA")
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();

  function fallback() {
    grid.innerHTML = `<div class="advisor-fallback">
      <span>PERSONAL ASSISTANCE</span>
      <h3>Our sales advisors are ready to assist you.</h3>
      <p>WhatsApp main line Izuwan dan kami akan sambungkan anda dengan advisor yang sesuai.</p>
      <a href="${window.IASBSite.whatsappUrl("Hai, saya ingin bercakap dengan sales advisor Izuwan Automobile.")}" target="_blank" rel="noopener">WhatsApp Main Line ↗</a>
    </div>`;
  }

  function render(people) {
    if (!people?.length) return fallback();
    grid.innerHTML = people.map(person => {
      const role = person.role || "Sales Advisor";
      const specialty = person.specialty || person.branch || "Ready Stock & Vehicle Enquiry";
      return `<article class="advisor-card">
        <div class="advisor-photo">${person.photo_url
          ? `<img loading="lazy" src="${person.photo_url}" alt="${person.name}, ${role}">`
          : `<span aria-hidden="true">${initials(person.name)}</span>`}</div>
        <div class="advisor-copy"><small>${role}</small><h3>${person.name}</h3><p>${specialty}</p></div>
        <a href="${window.IASBSite.whatsappUrl(`Hai ${person.name}, saya ingin bertanya tentang kereta Izuwan Automobile.`, person.whatsapp)}" target="_blank" rel="noopener">WhatsApp Advisor <b>↗</b></a>
      </article>`;
    }).join("");
  }

  window.addEventListener("iasb:data", event => render(event.detail.salesmen || []));
  window.addEventListener("iasb:error", fallback);
  if (!window.IASBData?.configured) fallback();
})();
