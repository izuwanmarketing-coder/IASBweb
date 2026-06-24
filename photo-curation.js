(() => {
  const telegramChassis = new Set([
    "RP3-1328579",
    "AGL20-0017237",
    "W1K1770842V145914",
    "WDD2130772A600811",
    "TAHA40-0002744",
    "AGH30-0412898",
    "AGH40-4004195",
    "RP3-1315849",
    "FK7-1103672",
    "MZRA90-0007684",
    "W1K1771472J333953",
    "W1N2477512J300463",
    "LA400K-0052280",
    "GDJ150-0061167",
    "GDJ150-0060470",
    "ZN-021044"
  ]);

  const isDocument = (photo) => {
    const name = String(photo.name || "").toLowerCase();
    return (
      name.includes("auction") ||
      name.includes("inspection report") ||
      name.includes("auction report") ||
      name.endsWith(".pdf") ||
      /^ar[\s_-]/i.test(name)
    );
  };

  const isNumberOneShot = (photo) => {
    const name = String(photo.name || "");
    return /(?:^|[\s_-])1(?:[\s_.-]|$)/i.test(name) ||
      /_\d+_1_\d+_l\./i.test(name);
  };

  Object.values(window.carPhotoData || {}).forEach((gallery) => {
    const cleaned = (gallery.photos || []).filter((photo) => !isDocument(photo));
    if (!cleaned.length) return;

    let coverIndex = 0;
    const telegramPhotos = cleaned
      .map((photo, index) => ({ photo, index }))
      .filter(({ photo }) => /^photo_\d+/i.test(String(photo.name || "")));

    if (telegramChassis.has(gallery.chassis) && telegramPhotos.length > 1) {
      // Telegram albums normally start with a straight-on shot;
      // the next photo is the showroom-friendly front three-quarter angle.
      coverIndex = telegramPhotos[1].index;
      gallery.source = "telegram";
    } else {
      const numberedCover = cleaned.findIndex(isNumberOneShot);
      if (numberedCover >= 0) coverIndex = numberedCover;
    }

    const [cover] = cleaned.splice(coverIndex, 1);
    gallery.photos = [cover, ...cleaned];
  });
})();
