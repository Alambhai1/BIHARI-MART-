module.exports = function(app, pool, requireAdmin) {
  let tableReady;
  async function ensureTable() {
    if (!tableReady) {
      tableReady = pool.query("CREATE TABLE IF NOT EXISTS bihari_ad_requests (id TEXT PRIMARY KEY, company_name TEXT NOT NULL, contact_name TEXT NOT NULL, email TEXT NOT NULL, whatsapp TEXT NOT NULL, country TEXT NOT NULL, company_website TEXT DEFAULT '', ad_title TEXT NOT NULL, ad_description TEXT NOT NULL, image_url TEXT DEFAULT '', target_url TEXT NOT NULL, placement TEXT NOT NULL, duration_days INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', payment_status TEXT NOT NULL DEFAULT 'not_configured', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reviewed_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)");
      tableReady.catch(() => { tableReady = null; });
    }
    await tableReady;
  }
  function safeUrl(value, optional) {
    if (optional && !value) return "";
    try {
      const u = new URL(value);
      return ["http:", "https:"].includes(u.protocol) ? u.toString() : null;
    } catch (_) { return null; }
  }

  app.post("/api/advertising-requests", async (req, res) => {
    try {
      await ensureTable();
      const clean = v => typeof v === "string" ? v.trim() : "";
      const d = {
        company: clean(req.body.companyName),
        contact: clean(req.body.contactName),
        email: clean(req.body.email),
        whatsapp: clean(req.body.whatsapp),
        country: clean(req.body.country),
        website: clean(req.body.companyWebsite),
        title: clean(req.body.adTitle),
        description: clean(req.body.adDescription),
        image: clean(req.body.imageUrl),
        target: clean(req.body.targetUrl),
        placement: clean(req.body.placement),
        days: Number(req.body.durationDays)
      };
      if (!d.company || !d.contact || !d.email || !d.whatsapp || !d.country ||
          !d.title || !d.description || !d.target ||
          !["banner", "sponsored"].includes(d.placement) || ![7,30].includes(d.days))
        return res.status(400).json({message:"Please complete all required fields."});
      if (d.company.length>120 || d.contact.length>100 || d.title.length>120 ||
          d.description.length>1000 || d.country.length>80)
        return res.status(400).json({message:"Some fields are too long."});
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email) ||
          !/^[+0-9()\s-]{7,30}$/.test(d.whatsapp))
        return res.status(400).json({message:"Enter a valid email and WhatsApp number."});
      d.website=safeUrl(d.website,true);
      d.image=safeUrl(d.image,true);
      d.target=safeUrl(d.target,false);
      if (d.website===null || d.image===null || d.target===null)
        return res.status(400).json({message:"Links must be valid http or https URLs."});
      const id="ad_"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
      await pool.query(
        "INSERT INTO bihari_ad_requests (id,company_name,contact_name,email,whatsapp,country,company_website,ad_title,ad_description,image_url,target_url,placement,duration_days) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
        [id,d.company,d.contact,d.email,d.whatsapp,d.country,d.website,d.title,d.description,d.image,d.target,d.placement,d.days]
      );
      res.status(201).json({message:"Request submitted. BIHARI MART will review it and contact you with the quote and payment instructions.",requestId:id,paymentEnabled:false});
    } catch(e) {
      console.error("Ad request:",e);
      res.status(500).json({message:"Could not submit advertising request."});
    }
  });

  app.get("/api/ads", async (req,res) => {
    try {
      await ensureTable();
      const r=await pool.query("SELECT id,company_name,ad_title,ad_description,image_url,target_url,placement FROM bihari_ad_requests WHERE status='active' AND expires_at>NOW() ORDER BY created_at DESC");
      res.json(r.rows);
    } catch(e) { res.status(500).json({message:"Could not load ads."}); }
  });

  app.get("/api/admin/advertising-requests", requireAdmin, async (req,res) => {
    try {
      await ensureTable();
      const r=await pool.query("SELECT id,company_name,contact_name,email,whatsapp,country,company_website,ad_title,ad_description,image_url,target_url,placement,duration_days,status,payment_status,created_at,expires_at FROM bihari_ad_requests ORDER BY created_at DESC LIMIT 200");
      res.json(r.rows);
    } catch(e) { res.status(500).json({message:"Could not load requests."}); }
  });

  app.patch("/api/admin/advertising-requests/:id/status", requireAdmin, async (req,res) => {
    try {
      await ensureTable();
      const status=req.body.status;
      if (!["approved","rejected","active","paused"].includes(status))
        return res.status(400).json({message:"Invalid status."});
      const q=await pool.query("SELECT status FROM bihari_ad_requests WHERE id=$1",[req.params.id]);
      if (!q.rows.length) return res.status(404).json({message:"Request not found."});
      const old=q.rows[0].status;
      if (status==="active") {
        if (!["approved","paused"].includes(old) || req.body.paymentVerified!==true)
          return res.status(400).json({message:"Approve first and verify advertiser payment outside the platform."});
        const r=await pool.query("UPDATE bihari_ad_requests SET status='active',payment_status='manually_verified',reviewed_at=NOW(),expires_at=NOW()+(duration_days * INTERVAL '1 day') WHERE id=$1 RETURNING id,status,payment_status,expires_at",[req.params.id]);
        return res.json({message:"Ad activated after manual payment verification.",request:r.rows[0]});
      }
      if (status==="approved" && old!=="pending")
        return res.status(409).json({message:"Only pending requests can be approved."});
      if (status==="rejected" && !["pending","approved"].includes(old))
        return res.status(409).json({message:"This request cannot be rejected now."});
      if (status==="paused" && old!=="active")
        return res.status(409).json({message:"Only active ads can be paused."});
      const r=await pool.query("UPDATE bihari_ad_requests SET status=$1,reviewed_at=NOW() WHERE id=$2 RETURNING id,status,payment_status,expires_at",[status,req.params.id]);
      res.json({message:"Advertising status updated.",request:r.rows[0]});
    } catch(e) {
      console.error("Ad status:",e);
      res.status(500).json({message:"Could not update advertising status."});
    }
  });
};
