(function () {
  const config = window.IASB_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  const client = configured
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  async function getInventory() {
    if (!client) return null;
    const { data, error } = await client
      .from("inventory")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: false });
    if (error) throw error;
      return data.map(row => ({
        id: row.id,
        brand: row.brand,
        model: row.model,
        year: row.year || "",
        grade: row.grade || "",
        variant: row.variant || "",
        type: row.type || "Other",
        price: Number(row.price),
        mileage: row.mileage == null ? null : Number(row.mileage),
        image_url: row.image_url || "",
        is_featured: Boolean(row.is_featured),
        status: row.status || "AVAILABLE",
        location: row.location || "",
        units: Number(row.units) || 1,
      created_at: row.created_at || "",
      updated_at: row.updated_at || ""
    }));
  }

  async function getSettings() {
    if (!client) return null;
    const { data, error } = await client
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function getEvents() {
    if (!client) return [];
    const { data, error } = await client
      .from("site_events")
      .select("*")
      .eq("is_active", true)
      .order("start_date", { ascending: false });
    if (error) {
      console.warn("Site events unavailable.", error);
      return [];
    }
    return data || [];
  }

  async function getSalesmen() {
    if (!client) return null;
    const { data, error } = await client
      .from("salesmen")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data;
  }

  window.IASBData = {
    client,
    configured,
    async loadPublicData() {
      if (!client) return { inventory: null, settings: null, salesmen: null };
      const [inventory, settings, salesmen] = await Promise.all([
        getInventory(),
        getSettings(),
        getSalesmen()
      ]);
      const events = await getEvents();
      return { inventory, settings, salesmen, events };
    }
  };
})();
