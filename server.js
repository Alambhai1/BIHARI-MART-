require("dotenv").config();
const pool = require("./db");
const INQUIRY_FILE = "inquiries.json";

const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const fs = require("fs");
const fileType = require("file-type");

const app = express();
app.set("trust proxy", 1);
const DB_FILE = "users.json";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static("public"));

function readUsers() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
}

app.get("/api", (req, res) => {
  res.json({
    name: "BIHARI MART",
    message: "Global Machinery Marketplace is Running",
    commission: "3%",
    features: ["Buyer Registration", "Seller Registration", "Login"]
  });
});


app.post("/api/register", async (req, res) => {
  try {
    const clean = (value) =>
      typeof value === "string" ? value.trim() : "";

    const name = clean(req.body.name);
    const phone = clean(req.body.phone);
    const password = req.body.password;
    const role = clean(req.body.role);

    const companyName = clean(req.body.companyName);
    const businessType = clean(req.body.businessType);
    const country = clean(req.body.country);
    const state = clean(req.body.state);
    const city = clean(req.body.city);
    const whatsapp = clean(req.body.whatsapp);
    const email = clean(req.body.email);
    const gstin = clean(req.body.gstin);
    const iec = clean(req.body.iec);
    const website = clean(req.body.website);

    if (!name || !phone || !password || !role ||
        !companyName || !businessType || !country) {
      return res.status(400).json({
        message: "Please fill all required fields"
      });
    }

    if (!/^[0-9]{10,15}$/.test(phone)) {
      return res.status(400).json({
        message: "Enter a valid mobile number with country code if needed"
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password must be 8 characters or longer"
      });
    }

    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({
        message: "Invalid account type"
      });
    }

    const allowedBusinessTypes = [
      "Manufacturer",
      "Exporter",
      "Importer",
      "Supplier",
      "Dealer/Distributor",
      "Trading Company"
    ];

    if (!allowedBusinessTypes.includes(businessType)) {
      return res.status(400).json({
        message: "Invalid business type"
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Enter a valid email address"
      });
    }

    if (whatsapp && !/^[+0-9()\s-]{7,20}$/.test(whatsapp)) {
      return res.status(400).json({
        message: "Enter a valid WhatsApp number"
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const user = {
      id: Date.now().toString(),
      name,
      phone,
      password: hash,
      role,
      verified: false,
      company: {
        companyName,
        businessType,
        country,
        state,
        city,
        whatsapp,
        email,
        gstin,
        iec,
        website
      }
    };

    await pool.query(
      `INSERT INTO users (id, name, phone, password, role, verified, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        user.id,
        user.name,
        user.phone,
        user.password,
        user.role,
        user.verified,
        JSON.stringify(user)
      ]
    );

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          message: "Registration session failed"
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            message: "Session save failed"
          });
        }

        res.json({
          message: "Company registration successful",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Phone already registered"
      });
    }

    console.error("Registration error:", error.message);
    res.status(500).json({
      message: "Registration failed"
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    const result = await pool.query(
      "SELECT id, name, phone, password, role FROM users WHERE phone = $1",
      [phone]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password || "", user.password))) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({ message: "Login failed" });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({ message: "Session save failed" });
        }

        res.json({
          message: "Login successful",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please login" });
  }

  res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ message: "Logout failed" });
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    res.json({ message: "Logged out successfully" });
  });
});




const multer = require("multer");
const path = require("path");

const LISTING_FILE = "listings.json";

function readListings() {
  if (!fs.existsSync(LISTING_FILE)) {
    fs.writeFileSync(LISTING_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(LISTING_FILE, "utf8"));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".mp4": "video/mp4"
    };

    const ext = path.extname(file.originalname).toLowerCase();
    const expectedMime = allowed[ext];

    if (!expectedMime || file.mimetype !== expectedMime) {
      return cb(new Error("File extension and type do not match"));
    }

    cb(null, true);
  }
});

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}


// Admin can view seller verification status
app.get("/api/admin/sellers", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, verified FROM users WHERE role = $1 ORDER BY name",
      ["seller"]
    );

    const sellers = result.rows.map(user => ({
      id: user.id,
      name: user.name,
      verified: user.verified === true
    }));

    res.json(sellers);
  } catch (error) {
    res.status(500).json({ message: "Could not load sellers" });
  }
});

// Only Admin can verify or unverify a seller
app.patch("/api/admin/sellers/:id/verification", requireAdmin, async (req, res) => {
  try {
    const { verified } = req.body;

    if (typeof verified !== "boolean") {
      return res.status(400).json({ message: "Invalid verification value" });
    }

    const result = await pool.query(
      `UPDATE users
       SET verified = $1,
           data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('verified', $1)
       WHERE id = $2 AND role = $3
       RETURNING id, name, verified`,
      [verified, req.params.id, "seller"]
    );

    const seller = result.rows[0];

    if (!seller) {
      return res.status(404).json({ message: "Seller not found" });
    }

    res.json({
      message: verified ? "Seller verified successfully" : "Seller verification removed",
      seller: {
        id: seller.id,
        name: seller.name,
        verified: seller.verified === true
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Seller verification failed" });
  }
});

// Public buyers can see approved listings only
app.get("/api/listings", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.data, u.verified AS seller_verified
      FROM listings l
      LEFT JOIN users u
        ON u.id = l.seller_id AND u.role = 'seller'
      WHERE l.status = 'approved'
      ORDER BY l.id DESC
    `);

    const listings = result.rows.map(row => ({
      ...(row.data || {}),
      sellerVerified: row.seller_verified === true
    }));

    res.json(listings);
  } catch (error) {
    console.error("Public listings load error:", error);
    res.status(500).json({ message: "Could not load listings" });
  }
});

// Admin can see all listings
app.get("/api/admin/listings", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT data FROM listings ORDER BY id DESC"
    );
    res.json(result.rows.map(row => row.data || {}));
  } catch (error) {
    console.error("Admin listings load error:", error);
    res.status(500).json({ message: "Could not load listings" });
  }
});

// Admin can approve or reject pending listings
app.patch("/api/admin/listings/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const current = await pool.query(
      "SELECT data, status FROM listings WHERE id = $1",
      [req.params.id]
    );

    if (current.rows.length === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    if (current.rows[0].status !== "pending") {
      return res.status(409).json({ message: "Listing is not pending" });
    }

    const item = {
      ...(current.rows[0].data || {}),
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.session.user.id
    };

    const updated = await pool.query(
      `UPDATE listings
       SET status = $1, data = $2::jsonb
       WHERE id = $3 AND status = 'pending'
       RETURNING data`,
      [status, JSON.stringify(item), req.params.id]
    );

    if (updated.rows.length === 0) {
      return res.status(409).json({ message: "Listing is not pending" });
    }

    res.json({ message: "Listing " + status, listing: updated.rows[0].data });
  } catch (error) {
    console.error("Listing status update error:", error);
    res.status(500).json({ message: "Could not update listing status" });
  }
});

app.post("/api/listings", (req, res) => {
  if (!req.session.user || req.session.user.role !== "seller") {
    return res.status(403).json({ message: "Seller login required" });
  }

  upload.array("media", 5)(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const allowedTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4"
      };

      for (const file of req.files || []) {
        const detected = await fileType.fromFile(file.path);
        const ext = path.extname(file.originalname).toLowerCase();
        const expectedMime = allowedTypes[ext];

        if (!detected || detected.mime !== expectedMime) {
          for (const uploadedFile of req.files || []) {
            try {
              fs.unlinkSync(uploadedFile.path);
            } catch (cleanupError) {}
          }

          return res.status(400).json({
            message: "File content does not match its extension"
          });
        }
      }
    } catch (validationError) {
      for (const uploadedFile of req.files || []) {
        try {
          fs.unlinkSync(uploadedFile.path);
        } catch (cleanupError) {}
      }

      return res.status(400).json({
        message: "Uploaded file could not be validated"
      });
    }

    try {
      const { title, category, price, currency, description, country, state, city } = req.body;

      if (!title || !title.trim() || !category || !price || !currency) {
        for (const file of req.files || []) {
          try { fs.unlinkSync(file.path); } catch (cleanupError) {}
        }
        return res.status(400).json({ message: "Required fields missing" });
      }

      const amount = Number(price);
      if (!Number.isFinite(amount) || amount <= 0) {
        for (const file of req.files || []) {
          try { fs.unlinkSync(file.path); } catch (cleanupError) {}
        }
        return res.status(400).json({ message: "Invalid price" });
      }

      const listing = {
        id: Date.now().toString(),
        sellerId: req.session.user.id,
        sellerName: req.session.user.name,
        status: "pending",
        title: title.trim(),
        category,
        price: amount,
        currency,
        country: (country || "").trim(),
        state: (state || "").trim(),
        city: (city || "").trim(),
        description: description || "",
        media: (req.files || []).map(file => "/uploads/" + file.filename),
        createdAt: new Date().toISOString()
      };

      await pool.query(
        `INSERT INTO listings
         (id, seller_id, status, title, category, data)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          listing.id,
          listing.sellerId,
          listing.status,
          listing.title,
          listing.category,
          JSON.stringify(listing)
        ]
      );

      res.json({ message: "Machine listing created", listing });
    } catch (error) {
      for (const file of req.files || []) {
        try { fs.unlinkSync(file.path); } catch (cleanupError) {}
      }
      res.status(500).json({ message: "Listing could not be saved" });
    }
  });
});


function readInquiries() {
  if (!fs.existsSync(INQUIRY_FILE)) {
    fs.writeFileSync(INQUIRY_FILE, "[]");
  }
  return JSON.parse(fs.readFileSync(INQUIRY_FILE, "utf8"));
}

app.post("/api/inquiries", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "buyer") {
      return res.status(403).json({ message: "Buyer login required" });
    }

    const { listingId, message } = req.body;

    if (!listingId || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Machine and message required" });
    }

    const listingResult = await pool.query(
      "SELECT data FROM listings WHERE id = $1 AND status = 'approved'",
      [String(listingId)]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ message: "Approved machine not found" });
    }

    const listing = listingResult.rows[0].data || {};

    const inquiry = {
      id: Date.now().toString(),
      listingId: listing.id,
      listingTitle: listing.title,
      sellerId: listing.sellerId,
      buyerId: req.session.user.id,
      buyerName: req.session.user.name,
      message: message.trim().slice(0, 1000),
      status: "new",
      createdAt: new Date().toISOString()
    };

    await pool.query(
      `INSERT INTO inquiries
       (id, listing_id, seller_id, buyer_id, status, data)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        inquiry.id,
        inquiry.listingId,
        inquiry.sellerId,
        inquiry.buyerId,
        inquiry.status,
        JSON.stringify(inquiry)
      ]
    );

    res.json({ message: "Your inquiry has been sent to the seller." });
  } catch (error) {
    console.error("Inquiry save error:", error);
    res.status(500).json({ message: "Inquiry could not be saved" });
  }
});

// Seller can see their own inquiries
app.get("/api/seller/inquiries", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "seller") {
      return res.status(403).json({ message: "Seller login required" });
    }

    const result = await pool.query(
      "SELECT data FROM inquiries WHERE seller_id = $1 ORDER BY id DESC",
      [req.session.user.id]
    );

    res.json(result.rows.map(row => row.data || {}));
  } catch (error) {
    console.error("Seller inquiries load error:", error);
    res.status(500).json({ message: "Could not load inquiries" });
  }
});

// Admin can see all inquiries
app.get("/api/admin/inquiries", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT data FROM inquiries ORDER BY id DESC"
    );

    res.json(result.rows.map(row => row.data || {}));
  } catch (error) {
    console.error("Admin inquiries load error:", error);
    res.status(500).json({ message: "Could not load inquiries" });
  }
});


// Admin can update buyer inquiry status
app.patch("/api/admin/inquiries/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    console.log("STATUS UPDATE REQUEST:", {
      id: req.params.id,
      status,
      admin: req.session.user.id
    });

    const allowedStatuses = ["new", "contacted", "closed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid inquiry status" });
    }

    const result = await pool.query(
      `UPDATE inquiries
       SET status = $1,
           data = jsonb_set(
             COALESCE(data, '{}'::jsonb),
             '{status}',
             to_jsonb($1::text),
             true
           )
       WHERE id = $2
       RETURNING data`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Inquiry not found" });
    }

    res.json({
      message: "Inquiry status updated successfully",
      inquiry: result.rows[0].data
    });
  } catch (error) {
    console.error("Inquiry status update error:", error);
    res.status(500).json({ message: "Could not update inquiry status" });
  }
});


// Admin: read-only founder commission ledger
app.get("/api/admin/commission-wallet", requireAdmin, async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT
        currency,
        COALESCE(SUM(gross_amount) FILTER (WHERE status = 'confirmed'), 0)::text AS confirmed_sales,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'confirmed'), 0)::text AS confirmed_commission,
        COALESCE(SUM(gross_amount) FILTER (WHERE status = 'pending_verification'), 0)::text AS pending_sales,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending_verification'), 0)::text AS pending_commission,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_count,
        COUNT(*) FILTER (WHERE status = 'pending_verification')::int AS pending_count
      FROM founder_commission_ledger
      GROUP BY currency
      ORDER BY currency
    `);

    const entries = await pool.query(`
      SELECT id, order_reference, seller_id,
             gross_amount::text, commission_rate::text,
             commission_amount::text, currency,
             payment_reference, status, created_at
      FROM founder_commission_ledger
      ORDER BY created_at DESC
      LIMIT 50
    `);

    res.json({
      summary: summary.rows,
      entries: entries.rows,
      withdrawalEnabled: false,
      note: "Ledger records only. Real funds are not held or withdrawable through this feature."
    });
  } catch (error) {
    console.error("Commission wallet load error:", error);
    res.status(500).json({ message: "Could not load commission wallet" });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("BIHARI MART Server Running");
  console.log("Open http://localhost:3000");
});
