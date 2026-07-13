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
      gallery_urls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
      description: row.description || "",
      engine: row.engine || "",
      transmission: row.transmission || "",
      exterior_color: row.exterior_color || "",
      interior_color: row.interior_color || "",
      campaign_tag: row.campaign_tag || "",
      chassis_no: row.chassis_no || "",
      marketing_label: row.marketing_label || "",
      is_featured: Boolean(row.is_featured),
      is_hot: Boolean(row.is_hot),
      auction_report: Boolean(row.auction_report),
      mileage_verified: Boolean(row.mileage_verified),
      grade_verified: Boolean(row.grade_verified),
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

  async function getDeliveries() {
    if (!client) return [];
    const { data, error } = await client
      .from("deliveries")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("delivered_at", { ascending: false });
    if (error) {
      console.warn("Delivered gallery unavailable.", error);
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
      if (!client) return { inventory: null, settings: null, salesmen: null, events: [], deliveries: [] };
      const [inventory, settings, salesmen, events, deliveries] = await Promise.all([
        getInventory(),
        getSettings(),
        getSalesmen(),
        getEvents(),
        getDeliveries()
      ]);
      return { inventory, settings, salesmen, events, deliveries };
    }
  };
})();
