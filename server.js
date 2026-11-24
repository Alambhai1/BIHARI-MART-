require("dotenv").config();
const pool = require("./db");
const INQUIRY_FILE = "inquiries.json";

const crypto = require("crypto");
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
    const businessIdentity = clean(req.body.businessIdentity);
    const businessSector = clean(req.body.businessSector);
    const country = clean(req.body.country);
    const state = clean(req.body.state);
    const city = clean(req.body.city);
    const whatsapp = clean(req.body.whatsapp);
    const email = clean(req.body.email);
    const gstin = clean(req.body.gstin);
    const iec = clean(req.body.iec);
    const website = clean(req.body.website);

    if (!name || !phone || !password || !role ||
        !companyName || !businessType || !country ||
        !businessIdentity || !businessSector) {
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

    const allowedBusinessIdentities = [
      "Company Owner",
      "Manufacturer",
      "Dealer",
      "Supplier",
      "Exporter",
      "Importer",
      "Trading Company"
    ];

    const allowedBusinessSectors = [
      "Bus",
      "Truck",
      "Car",
      "Bike / Motorcycle",
      "Automobile Parts",
      "Industrial Machinery",
      "Other Business"
    ];

    if (!allowedBusinessIdentities.includes(businessIdentity) ||
        !allowedBusinessSectors.includes(businessSector)) {
      return res.status(400).json({
        message: "Invalid business identity or sector"
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
        businessIdentity,
        businessSector,
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
  console.log("LOGIN REQUEST RECEIVED");
  console.log("LOGIN PHONE:", req.body?.phone);

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
        console.error("LOGIN SESSION REGENERATE ERROR:", error);
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
          console.error("LOGIN SESSION SAVE ERROR:", saveError);
          return res.status(500).json({ message: "Session save failed" });
        }

        res.json({
          message: "Login successful",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    console.error("LOGIN API ERROR:", error);
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
      const { title, category, price, currency, description, country, state, city, stock, unit } = req.body;

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

      const stockAmount = stock === undefined || stock === "" ? null : Number(stock);
      if (stockAmount !== null && (!Number.isFinite(stockAmount) || stockAmount < 0)) {
        for (const file of req.files || []) {
          try { fs.unlinkSync(file.path); } catch (cleanupError) {}
        }
        return res.status(400).json({ message: "Invalid stock quantity" });
      }
      const unitName = typeof unit === "string" ? unit.trim().slice(0, 30) : "";
      const listing = {
        id: Date.now().toString(),
        sellerId: req.session.user.id,
        sellerName: req.session.user.name,
        status: "pending",
        title: title.trim(),
        category,
        price: amount,
        currency,
        stock: stockAmount, unit: unitName,
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

      res.json({ message: "Product / service listing submitted for admin approval", listing });
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


// Confidential Government Assistance Request - Admin only
app.get("/api/admin/government-assistance", requireAdmin, (req, res) => {
  res.set("Cache-Control", "no-store, private");
  res.json({
    title: "Confidential Government Assistance Request",
    visibility: "Admin only",
    status: "Draft - Not yet submitted to Government",
    request: [
      "To: Concerned Government of India Department",
      "Subject: Request for an official invitation and assistance with essential government documents for BIHARI MART.",
      "The founder/admin of BIHARI MART respectfully requests the concerned government department to officially invite them for guidance and assistance.",
      "Please guide and facilitate the applicable company registration, business identity, tax, licence and other legally required documents and approvals.",
      "As government procedures may take time, kindly consider the request at the earliest possible opportunity.",
      "All documents and approvals will be obtained through the applicable lawful government procedures."
    ],
    note: "This is a private draft. It has not been submitted to or approved by any government department."
  });
});


// GLOBAL EDUCATION INSTITUTION API

const allowedInstitutionTypes = [
  "School",
  "College",
  "University",
  "Training Institute"
];

// Register an institution - login required
app.post("/api/education/institutions", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login first" });
    }

    const clean = value =>
      typeof value === "string" ? value.trim() : "";

    const institutionName = clean(req.body.institutionName);
    const institutionType = clean(req.body.institutionType);
    const country = clean(req.body.country);
    const city = clean(req.body.city);
    const email = clean(req.body.email);
    const website = clean(req.body.website);
    const recognitionDetails = clean(req.body.recognitionDetails);

    if (!institutionName || !institutionType || !country) {
      return res.status(400).json({
        message: "Institution name, type and country are required"
      });
    }

    if (institutionName.length > 160 ||
        country.length > 100 ||
        city.length > 100 ||
        recognitionDetails.length > 2000) {
      return res.status(400).json({
        message: "One or more fields are too long"
      });
    }

    if (!allowedInstitutionTypes.includes(institutionType)) {
      return res.status(400).json({
        message: "Invalid institution type"
      });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    if (website) {
      try {
        const parsed = new URL(website);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return res.status(400).json({
          message: "Enter a valid website URL starting with https://"
        });
      }
    }

    const duplicate = await pool.query(
      `SELECT id FROM education_institutions
       WHERE owner_user_id = $1
       AND LOWER(institution_name) = LOWER($2)
       AND status <> 'rejected'
       LIMIT 1`,
      [req.session.user.id, institutionName]
    );

    if (duplicate.rows.length) {
      return res.status(409).json({
        message: "This institution application already exists"
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO education_institutions
       (id, owner_user_id, institution_name, institution_type,
        country, city, email, website, recognition_details, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
      [
        id,
        req.session.user.id,
        institutionName,
        institutionType,
        country,
        city || null,
        email || null,
        website || null,
        recognitionDetails || null
      ]
    );

    res.status(201).json({
      message: "Institution application submitted for admin review",
      institutionId: id,
      status: "pending"
    });
  } catch (error) {
    console.error("Education institution registration error:", error);
    res.status(500).json({
      message: "Institution registration failed"
    });
  }
});


// Public list - approved institutions only
app.get("/api/education/institutions", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, institution_name, institution_type,
              country, city, website
       FROM education_institutions
       WHERE status = 'approved'
       ORDER BY created_at DESC`
    );

    res.set("Cache-Control", "no-store");
    res.json({ institutions: result.rows });
  } catch (error) {
    console.error("Education public list error:", error);
    res.status(500).json({ message: "Could not load institutions" });
  }
});


// Admin: view all institution applications
app.get("/api/admin/education/institutions", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, owner_user_id, institution_name, institution_type,
              country, city, email, website, recognition_details,
              status, created_at
       FROM education_institutions
       ORDER BY created_at DESC`
    );

    res.set("Cache-Control", "no-store, private");
    res.json({ institutions: result.rows });
  } catch (error) {
    console.error("Admin education list error:", error);
    res.status(500).json({ message: "Could not load applications" });
  }
});


// Admin: approve or reject institution
app.patch("/api/admin/education/institutions/:id/status", requireAdmin, async (req, res) => {
  try {
    const status = req.body.status;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        message: "Status must be approved, rejected or pending"
      });
    }

    const result = await pool.query(
      `UPDATE education_institutions
       SET status = $1
       WHERE id = $2
       RETURNING id, institution_name, status`,
      [status, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Institution not found" });
    }

    res.json({
      message: "Institution status updated",
      institution: result.rows[0]
    });
  } catch (error) {
    console.error("Education approval error:", error);
    res.status(500).json({ message: "Could not update institution status" });
  }
});



// GLOBAL EDUCATION COURSES API

const allowedCourseModes = ["online", "offline", "hybrid"];
const allowedCurrencies = ["INR", "USD", "EUR", "GBP", "AED"];


// Institution owner: add a course
app.post("/api/education/institutions/:institutionId/courses", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login first" });
    }

    const clean = value =>
      typeof value === "string" ? value.trim() : "";

    const courseName = clean(req.body.courseName);
    const category = clean(req.body.category);
    const description = clean(req.body.description);
    const duration = clean(req.body.duration);
    const mode = clean(req.body.mode) || "online";
    const currency = clean(req.body.currency) || "INR";

    const feeInput = req.body.fee;
    let fee = null;

    if (feeInput !== undefined && feeInput !== null && feeInput !== "") {
      fee = Number(feeInput);

      if (!Number.isFinite(fee) || fee < 0 || fee > 9999999999.99) {
        return res.status(400).json({ message: "Invalid course fee" });
      }
    }

    if (!courseName || !category) {
      return res.status(400).json({
        message: "Course name and category are required"
      });
    }

    if (courseName.length > 160 || category.length > 100 ||
        description.length > 3000 || duration.length > 100) {
      return res.status(400).json({ message: "One or more fields are too long" });
    }

    if (!allowedCourseModes.includes(mode)) {
      return res.status(400).json({ message: "Invalid course mode" });
    }

    if (!allowedCurrencies.includes(currency)) {
      return res.status(400).json({ message: "Invalid currency" });
    }

    const institution = await pool.query(
      `SELECT id FROM education_institutions
       WHERE id = $1 AND owner_user_id = $2 AND status = 'approved'`,
      [req.params.institutionId, req.session.user.id]
    );

    if (!institution.rows.length) {
      return res.status(403).json({
        message: "Only the owner of an approved institution can add courses"
      });
    }

    const id = crypto.randomUUID();

    await pool.query(
      `INSERT INTO education_courses
       (id, institution_id, course_name, category, description,
        duration, mode, fee, currency, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
      [
        id,
        req.params.institutionId,
        courseName,
        category,
        description || null,
        duration || null,
        mode,
        fee,
        currency
      ]
    );

    res.status(201).json({
      message: "Course submitted for admin review",
      courseId: id,
      status: "pending"
    });
  } catch (error) {
    console.error("Education course creation error:", error);
    res.status(500).json({ message: "Could not add course" });
  }
});


// Public: approved courses only
app.get("/api/education/courses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.course_name, c.category, c.description,
              c.duration, c.mode, c.fee, c.currency,
              i.institution_name, i.country, i.city
       FROM education_courses c
       JOIN education_institutions i ON i.id = c.institution_id
       WHERE c.status = 'approved'
         AND i.status = 'approved'
       ORDER BY c.created_at DESC`
    );

    res.set("Cache-Control", "no-store");
    res.json({ courses: result.rows });
  } catch (error) {
    console.error("Education public courses error:", error);
    res.status(500).json({ message: "Could not load courses" });
  }
});


// Admin: view all courses
app.get("/api/admin/education/courses", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.institution_id, c.course_name, c.category,
              c.description, c.duration, c.mode, c.fee, c.currency,
              c.status, c.created_at, i.institution_name
       FROM education_courses c
       JOIN education_institutions i ON i.id = c.institution_id
       ORDER BY c.created_at DESC`
    );

    res.set("Cache-Control", "no-store, private");
    res.json({ courses: result.rows });
  } catch (error) {
    console.error("Admin education courses error:", error);
    res.status(500).json({ message: "Could not load courses" });
  }
});


// Admin: approve, reject or return course to pending
app.patch("/api/admin/education/courses/:id/status", requireAdmin, async (req, res) => {
  try {
    const status = req.body.status;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        message: "Status must be approved, rejected or pending"
      });
    }

    const result = await pool.query(
      `UPDATE education_courses
       SET status = $1
       WHERE id = $2
       RETURNING id, course_name, status`,
      [status, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json({
      message: "Course status updated",
      course: result.rows[0]
    });
  } catch (error) {
    console.error("Education course approval error:", error);
    res.status(500).json({ message: "Could not update course status" });
  }
});



// GLOBAL EDUCATION ADMISSION API

// Student: apply for an approved course (buyer account is used as student)
app.post("/api/education/courses/:courseId/apply", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login first" });
    }
    if (req.session.user.role !== "buyer") {
      return res.status(403).json({ message: "Please login with a student/buyer account" });
    }

    const courseId = req.params.courseId;
    const message = String(req.body.message || "").trim().slice(0, 2000);

    const course = await pool.query(
      `SELECT c.id
       FROM education_courses c
       JOIN education_institutions i ON i.id = c.institution_id
       WHERE c.id = $1 AND c.status = 'approved' AND i.status = 'approved'`,
      [courseId]
    );

    if (!course.rows.length) {
      return res.status(404).json({ message: "Approved course not found" });
    }

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO education_applications
       (id, course_id, student_user_id, message)
       VALUES ($1, $2, $3, $4)`,
      [id, courseId, req.session.user.id, message]
    );

    res.status(201).json({ message: "Application submitted successfully", applicationId: id });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "You have already applied for this course" });
    }
    console.error("Student application error:", err);
    res.status(500).json({ message: "Could not submit application" });
  }
});

// Student: view only their own applications
app.get("/api/education/my-applications", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login first" });
    }

    const result = await pool.query(
      `SELECT a.id, a.message, a.status, a.created_at,
              c.course_name, c.category, c.mode, c.duration,
              i.institution_name, i.country, i.city
       FROM education_applications a
       JOIN education_courses c ON c.id = a.course_id
       JOIN education_institutions i ON i.id = c.institution_id
       WHERE a.student_user_id = $1
       ORDER BY a.created_at DESC`,
      [req.session.user.id]
    );

    res.json({ applications: result.rows });
  } catch (err) {
    console.error("Student applications error:", err);
    res.status(500).json({ message: "Could not load applications" });
  }
});

// Institution owner: view applications for their own institutions only
app.get("/api/institution/education/applications", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login first" });
    }

    const result = await pool.query(
      `SELECT a.id, a.message, a.status, a.created_at,
              u.name AS student_name, u.phone AS student_phone,
              c.course_name, i.institution_name
       FROM education_applications a
       JOIN education_courses c ON c.id = a.course_id
       JOIN education_institutions i ON i.id = c.institution_id
       JOIN users u ON u.id = a.student_user_id
       WHERE i.owner_user_id = $1
       ORDER BY a.created_at DESC`,
      [req.session.user.id]
    );

    res.json({ applications: result.rows });
  } catch (err) {
    console.error("Institution applications error:", err);
    res.status(500).json({ message: "Could not load institution applications" });
  }
});

// Institution owner: update status only for applications belonging to their institution
app.patch("/api/institution/education/applications/:id/status", async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login first" });
    }

    const status = String(req.body.status || "");
    if (!["reviewing", "accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid application status" });
    }

    const result = await pool.query(
      `UPDATE education_applications a
       SET status = $1
       FROM education_courses c, education_institutions i
       WHERE a.id = $2
         AND a.course_id = c.id
         AND c.institution_id = i.id
         AND i.owner_user_id = $3
       RETURNING a.id, a.status`,
      [status, req.params.id, req.session.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Application not found for your institution" });
    }

    res.json({ message: "Application status updated", application: result.rows[0] });
  } catch (err) {
    console.error("Institution application update error:", err);
    res.status(500).json({ message: "Could not update application" });
  }
});

// Admin: view all education applications
app.get("/api/admin/education/applications", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.message, a.status, a.created_at,
              u.name AS student_name, u.phone AS student_phone,
              c.course_name, i.institution_name, i.country
       FROM education_applications a
       JOIN education_courses c ON c.id = a.course_id
       JOIN education_institutions i ON i.id = c.institution_id
       JOIN users u ON u.id = a.student_user_id
       ORDER BY a.created_at DESC`
    );

    res.json({ applications: result.rows });
  } catch (err) {
    console.error("Admin education applications error:", err);
    res.status(500).json({ message: "Could not load applications" });
  }
});

// Admin: update any education application status
app.patch("/api/admin/education/applications/:id/status", requireAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || "");
    if (!["new", "reviewing", "accepted", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid application status" });
    }

    const result = await pool.query(
      `UPDATE education_applications
       SET status = $1
       WHERE id = $2
       RETURNING id, status`,
      [status, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Application not found" });
    }

    res.json({ message: "Application status updated", application: result.rows[0] });
  } catch (err) {
    console.error("Admin application update error:", err);
    res.status(500).json({ message: "Could not update application" });
  }
});



// BIHARI_DIGITAL_SERVICES_V1
async function ensureDigitalTransactions() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS digital_service_transactions (
      id BIGSERIAL PRIMARY KEY,
      transaction_ref TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_phone TEXT,
      service_type TEXT NOT NULL,
      operator TEXT,
      customer_mobile TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_reference TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

function requireDigitalUser(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({message:"Please login first"});
  }
  if (!["seller","admin"].includes(req.session.user.role)) {
    return res.status(403).json({message:"Seller account required"});
  }
  next();
}

// Shopkeeper creates a transaction request.
// Real payment is NOT processed without an authorized provider.
app.post("/api/digital-services/transactions", requireDigitalUser, async (req,res) => {
  try {
    await ensureDigitalTransactions();

    const type = String(req.body.service_type || "");
    const operator = String(req.body.operator || "").trim().slice(0,50);
    const mobile = String(req.body.customer_mobile || "").trim();
    const amount = Number(req.body.amount);

    if (!["mobile_recharge","money_transfer","bill_payment"].includes(type))
      return res.status(400).json({message:"Invalid service type"});

    if (!/^[0-9]{10,15}$/.test(mobile))
      return res.status(400).json({message:"Enter valid customer mobile number"});

    if (!Number.isFinite(amount) || amount < 1 || amount > 100000)
      return res.status(400).json({message:"Invalid amount"});

    const ref = "BM" + Date.now() + crypto.randomBytes(3).toString("hex").toUpperCase();
    const user = req.session.user;

    const result = await pool.query(
      `INSERT INTO digital_service_transactions
       (transaction_ref,user_id,user_name,user_phone,service_type,operator,customer_mobile,amount)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [ref,String(user.id),user.name || "",user.phone || "",type,operator,mobile,amount]
    );

    res.status(201).json({
      message:"Request recorded. Waiting for authorized service provider.",
      transaction:result.rows[0]
    });
  } catch(err) {
    console.error("Digital transaction error:",err);
    res.status(500).json({message:"Could not save transaction"});
  }
});

// Shopkeeper sees own transaction history
app.get("/api/digital-services/my-transactions", requireDigitalUser, async (req,res) => {
  try {
    await ensureDigitalTransactions();
    const result = await pool.query(
      `SELECT transaction_ref,service_type,operator,customer_mobile,
       amount,status,created_at FROM digital_service_transactions
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [String(req.session.user.id)]
    );
    res.json({transactions:result.rows});
  } catch(err) {
    console.error(err);
    res.status(500).json({message:"Could not load transactions"});
  }
});

// Admin sees all digital service requests
app.get("/api/admin/digital-transactions", requireAdmin, async (req,res) => {
  try {
    await ensureDigitalTransactions();
    const result = await pool.query(
      "SELECT * FROM digital_service_transactions ORDER BY created_at DESC LIMIT 500"
    );
    res.json({transactions:result.rows});
  } catch(err) {
    console.error(err);
    res.status(500).json({message:"Could not load digital transactions"});
  }
});

// Admin can process or fail a request.
// Success must come from a verified provider callback in a future integration.
app.patch("/api/admin/digital-transactions/:id/status", requireAdmin, async (req,res) => {
  try {
    const status = String(req.body.status || "");
    if (!["processing","failed"].includes(status))
      return res.status(400).json({message:"Only processing or failed can be set manually"});

    await ensureDigitalTransactions();
    const result = await pool.query(
      `UPDATE digital_service_transactions
       SET status=$1,updated_at=NOW()
       WHERE id=$2 RETURNING transaction_ref,status`,
      [status,req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({message:"Transaction not found"});
    res.json({message:"Status updated",transaction:result.rows[0]});
  } catch(err) {
    console.error(err);
    res.status(500).json({message:"Could not update status"});
  }
});



// JOB_WORK_MARKETPLACE_V1
async function ensureJobWorkTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS job_work_jobs (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    data JSONB NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS job_work_quotations (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    data JSONB NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jw_jobs_status_idx ON job_work_jobs(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS jw_quotes_job_idx ON job_work_quotations(job_id)`);
}

function jwText(v, max = 1500) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Buyer posts a job
app.post("/api/job-work/jobs", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "buyer")
      return res.status(403).json({message:"Buyer login required"});
    await ensureJobWorkTables();

    const b = req.body || {};
    const type = jwText(b.type, 30);
    const title = jwText(b.title, 120);
    const description = jwText(b.description, 3000);
    const quantity = Number(b.quantity);
    const budget = b.budget === "" || b.budget == null ? null : Number(b.budget);
    const currency = jwText(b.currency, 5).toUpperCase();
    const unit = jwText(b.unit, 30);
    const country = jwText(b.country, 80);

    if (!["Fasteners","Automobile"].includes(type) || !title || !description ||
        !Number.isFinite(quantity) || quantity <= 0 || !unit || !country ||
        (budget !== null && (!Number.isFinite(budget) || budget <= 0)) ||
        !["INR","USD","EUR","GBP","AED"].includes(currency))
      return res.status(400).json({message:"Please enter valid job details, quantity, country and currency"});

    const job = {
      id: Date.now().toString() + Math.random().toString(36).slice(2,7),
      buyerId:req.session.user.id, buyerName:req.session.user.name,
      type,title,description,quantity,unit,budget,currency,
      deadline:jwText(b.deadline,30), country, city:jwText(b.city,80),
      status:"open", createdAt:new Date().toISOString()
    };
    await pool.query(
      "INSERT INTO job_work_jobs (id,buyer_id,status,data) VALUES ($1,$2,'open',$3::jsonb)",
      [job.id,job.buyerId,JSON.stringify(job)]
    );
    res.json({message:"Job Work posted successfully",job});
  } catch(e) {
    console.error("Job Work post:",e);
    res.status(500).json({message:"Could not post Job Work"});
  }
});

// Seller views open jobs
app.get("/api/job-work/jobs", async (req,res) => {
  try {
    if (!req.session.user || req.session.user.role !== "seller")
      return res.status(403).json({message:"Seller / Job Worker login required"});
    await ensureJobWorkTables();
    const r = await pool.query("SELECT data FROM job_work_jobs WHERE status='open' ORDER BY id DESC LIMIT 100");
    res.json(r.rows.map(x=>x.data || {}));
  } catch(e) {
    console.error("Job Work list:",e);
    res.status(500).json({message:"Could not load jobs"});
  }
});

// Buyer views own jobs
app.get("/api/job-work/my-jobs", async (req,res) => {
  try {
    if (!req.session.user || req.session.user.role !== "buyer")
      return res.status(403).json({message:"Buyer login required"});
    await ensureJobWorkTables();
    const r = await pool.query("SELECT data FROM job_work_jobs WHERE buyer_id=$1 ORDER BY id DESC",[req.session.user.id]);
    res.json(r.rows.map(x=>x.data || {}));
  } catch(e) {
    console.error("My Job Work:",e);
    res.status(500).json({message:"Could not load your jobs"});
  }
});

// Seller submits quotation
app.post("/api/job-work/jobs/:id/quotations", async (req,res) => {
  try {
    if (!req.session.user || req.session.user.role !== "seller")
      return res.status(403).json({message:"Seller / Job Worker login required"});
    await ensureJobWorkTables();

    const amount = Number(req.body.amount);
    const days = Number(req.body.deliveryDays);
    const currency = jwText(req.body.currency,5).toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 ||
        !Number.isInteger(days) || days <= 0 ||
        !["INR","USD","EUR","GBP","AED"].includes(currency))
      return res.status(400).json({message:"Enter valid quotation amount and delivery days"});

    const job = await pool.query("SELECT buyer_id FROM job_work_jobs WHERE id=$1 AND status='open'",[req.params.id]);
    if (!job.rows.length) return res.status(404).json({message:"Open job not found"});
    if (job.rows[0].buyer_id === req.session.user.id)
      return res.status(403).json({message:"You cannot quote on your own job"});

    const duplicate = await pool.query("SELECT id FROM job_work_quotations WHERE job_id=$1 AND seller_id=$2",[req.params.id,req.session.user.id]);
    if (duplicate.rows.length) return res.status(409).json({message:"You have already quoted on this job"});

    const q = {
      id:Date.now().toString()+Math.random().toString(36).slice(2,7),
      jobId:req.params.id, sellerId:req.session.user.id,
      sellerName:req.session.user.name, amount, currency,
      deliveryDays:days, message:jwText(req.body.message,1500),
      status:"submitted", plannedCommissionRate:"1%",
      createdAt:new Date().toISOString()
    };
    await pool.query(
      "INSERT INTO job_work_quotations (id,job_id,seller_id,status,data) VALUES ($1,$2,$3,'submitted',$4::jsonb)",
      [q.id,q.jobId,q.sellerId,JSON.stringify(q)]
    );
    res.json({message:"Quotation submitted. Planned commission is 1%; no money is deducted.",quotation:q});
  } catch(e) {
    console.error("Job Work quotation:",e);
    res.status(500).json({message:"Could not submit quotation"});
  }
});

// Buyer views quotations for own job only
app.get("/api/job-work/jobs/:id/quotations", async (req,res) => {
  try {
    if (!req.session.user || req.session.user.role !== "buyer")
      return res.status(403).json({message:"Buyer login required"});
    await ensureJobWorkTables();
    const job = await pool.query("SELECT buyer_id FROM job_work_jobs WHERE id=$1",[req.params.id]);
    if (!job.rows.length || job.rows[0].buyer_id !== req.session.user.id)
      return res.status(404).json({message:"Your job was not found"});
    const r = await pool.query("SELECT data FROM job_work_quotations WHERE job_id=$1 ORDER BY id DESC",[req.params.id]);
    res.json(r.rows.map(x=>x.data || {}));
  } catch(e) {
    console.error("Job Work quotations list:",e);
    res.status(500).json({message:"Could not load quotations"});
  }
});

// Buyer accepts a quotation; one quotation wins
app.patch("/api/job-work/quotations/:id/accept", async (req,res) => {
  let c;
  try {
    if (!req.session.user || req.session.user.role !== "buyer")
      return res.status(403).json({message:"Buyer login required"});
    await ensureJobWorkTables();
    c = await pool.connect();
    await c.query("BEGIN");
    const found = await c.query(
      `SELECT q.job_id,q.status AS quote_status,j.buyer_id,j.status AS job_status
       FROM job_work_quotations q JOIN job_work_jobs j ON j.id=q.job_id
       WHERE q.id=$1 FOR UPDATE OF q,j`,[req.params.id]);
    if (!found.rows.length || found.rows[0].buyer_id !== req.session.user.id) {
      await c.query("ROLLBACK");
      return res.status(404).json({message:"Quotation not found for your job"});
    }
    const row = found.rows[0];
    if (row.job_status !== "open" || row.quote_status !== "submitted") {
      await c.query("ROLLBACK");
      return res.status(409).json({message:"Job or quotation is no longer available"});
    }
    await c.query(
      `UPDATE job_work_quotations SET
       status=CASE WHEN id=$1 THEN 'accepted' ELSE 'not_selected' END,
       data=jsonb_set(COALESCE(data,'{}'::jsonb),'{status}',
       to_jsonb(CASE WHEN id=$1 THEN 'accepted' ELSE 'not_selected' END),true)
       WHERE job_id=$2`,[req.params.id,row.job_id]);
    await c.query(
      `UPDATE job_work_jobs SET status='awarded',
       data=jsonb_set(COALESCE(data,'{}'::jsonb),'{status}','"awarded"'::jsonb,true)
       WHERE id=$1`,[row.job_id]);
    await c.query("COMMIT");
    res.json({message:"Quotation accepted. Job awarded. Payment and actual commission deduction are not enabled."});
  } catch(e) {
    if (c) try { await c.query("ROLLBACK"); } catch(_) {}
    console.error("Accept Job Work quotation:",e);
    res.status(500).json({message:"Could not accept quotation"});
  } finally {
    if (c) c.release();
  }
});



// BIHARI MART GLOBAL MARKETPLACE ORDERS V1
async function ensureMarketplaceOrdersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_orders (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      listing_title TEXT NOT NULL,
      category TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(14,2) NOT NULL,
      total_price NUMERIC(14,2) NOT NULL,
      currency TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Buyer places an order for an approved listing
app.post("/api/orders", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "buyer") {
      return res.status(403).json({ message: "Buyer login required" });
    }

    const { listingId, quantity, deliveryAddress, note } = req.body;
    const qty = Number(quantity);

    if (!listingId || !Number.isInteger(qty) || qty < 1 || qty > 10000 ||
        typeof deliveryAddress !== "string" || !deliveryAddress.trim()) {
      return res.status(400).json({ message: "Valid product, quantity and delivery address required" });
    }

    await ensureMarketplaceOrdersTable();

    const result = await pool.query(
      "SELECT id, seller_id, data FROM listings WHERE id = $1 AND status = 'approved'",
      [String(listingId)]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Approved product not found" });
    }

    const listing = result.rows[0].data || {};
    const sellerId = String(result.rows[0].seller_id);
    const buyerId = String(req.session.user.id);

    if (sellerId === buyerId) {
      return res.status(400).json({ message: "You cannot order your own listing" });
    }

    const price = Number(listing.price);
    if (!Number.isFinite(price) || price <= 0 || !listing.currency) {
      return res.status(400).json({ message: "Product price or currency is invalid" });
    }

    const total = Number((price * qty).toFixed(2));
    const orderId = Date.now().toString() + "-" + Math.random().toString(36).slice(2, 10);

    const inserted = await pool.query(`
      INSERT INTO marketplace_orders
      (id, listing_id, listing_title, category, buyer_id, seller_id,
       quantity, unit_price, total_price, currency, delivery_address, note)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [
      orderId, String(listingId), String(listing.title || "Product"),
      String(listing.category || "Other"), buyerId, sellerId,
      qty, price, total, String(listing.currency),
      deliveryAddress.trim(),
      typeof note === "string" ? note.trim().slice(0, 1000) : ""
    ]);

    res.status(201).json({
      message: "Order request created. Payment and delivery are not yet enabled.",
      order: inserted.rows[0]
    });
  } catch (error) {
    console.error("Marketplace order creation error:", error);
    res.status(500).json({ message: "Could not create order" });
  }
});

// Buyer sees only their own orders
app.get("/api/my-orders", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "buyer") {
      return res.status(403).json({ message: "Buyer login required" });
    }
    await ensureMarketplaceOrdersTable();
    const result = await pool.query(
      "SELECT * FROM marketplace_orders WHERE buyer_id = $1 ORDER BY created_at DESC",
      [String(req.session.user.id)]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Buyer orders error:", error);
    res.status(500).json({ message: "Could not load orders" });
  }
});

// Seller sees only orders for their own products
app.get("/api/seller/orders", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "seller") {
      return res.status(403).json({ message: "Seller login required" });
    }
    await ensureMarketplaceOrdersTable();
    const result = await pool.query(
      "SELECT * FROM marketplace_orders WHERE seller_id = $1 ORDER BY created_at DESC",
      [String(req.session.user.id)]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Seller orders error:", error);
    res.status(500).json({ message: "Could not load seller orders" });
  }
});

// Seller updates order status for their own orders
app.patch("/api/seller/orders/:id/status", async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== "seller") {
      return res.status(403).json({ message: "Seller login required" });
    }

    const allowed = ["accepted", "preparing", "ready", "dispatched", "delivered", "cancelled"];
    const status = req.body.status;

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    await ensureMarketplaceOrdersTable();
    const result = await pool.query(
      `UPDATE marketplace_orders SET status = $1
       WHERE id = $2 AND seller_id = $3 RETURNING *`,
      [status, String(req.params.id), String(req.session.user.id)]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Order not found for this seller" });
    }
    res.json({ message: "Order status updated", order: result.rows[0] });
  } catch (error) {
    console.error("Seller order update error:", error);
    res.status(500).json({ message: "Could not update order" });
  }
});


// Separate Education Centre API
app.use("/education-api", require("./education-standalone"));

require("./advertising")(app, pool, requireAdmin);

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("BIHARI MART Server Running");
  console.log("Open http://localhost:3000");
});
