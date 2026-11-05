require("dotenv").config();
const INQUIRY_FILE = "inquiries.json";

const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");
const fileType = require("file-type");

const app = express();
const DB_FILE = "users.json";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
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
    const { name, phone, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!/^[0-9]{10,15}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be 8 characters or longer" });
    }

    if (!["buyer", "seller"].includes(role)) {
      return res.status(400).json({ message: "Invalid account type" });
    }

    const users = readUsers();

    if (users.some(user => user.phone === phone)) {
      return res.status(409).json({ message: "Phone already registered" });
    }

    const hash = await bcrypt.hash(password, 12);

    const user = {
      id: Date.now().toString(),
      name: name.trim(),
      phone,
      password: hash,
      role
    };

    users.push(user);
    saveUsers(users);

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({ message: "Registration session failed" });
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
          message: "Registration successful",
          user: req.session.user
        });
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const users = readUsers();
    const user = users.find(item => item.phone === phone);

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
      secure: false,
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
app.get("/api/admin/sellers", requireAdmin, (req, res) => {
  const sellers = readUsers()
    .filter(user => user.role === "seller")
    .map(user => ({
      id: user.id,
      name: user.name,
      verified: user.verified === true
    }));

  res.json(sellers);
});

// Only Admin can verify or unverify a seller
app.patch("/api/admin/sellers/:id/verification", requireAdmin, (req, res) => {
  const { verified } = req.body;

  if (typeof verified !== "boolean") {
    return res.status(400).json({ message: "Invalid verification value" });
  }

  const users = readUsers();
  const seller = users.find(user =>
    user.id === req.params.id && user.role === "seller"
  );

  if (!seller) {
    return res.status(404).json({ message: "Seller not found" });
  }

  seller.verified = verified;
  saveUsers(users);

  res.json({
    message: verified ? "Seller verified successfully" : "Seller verification removed",
    seller: { id: seller.id, name: seller.name, verified: seller.verified }
  });
});

// Public buyers can see approved listings only
app.get("/api/listings", (req, res) => {
  const users = readUsers();

  const listings = readListings()
    .filter(item => item.status === "approved")
    .map(item => {
      const seller = users.find(user =>
        user.id === item.sellerId && user.role === "seller"
      );

      return {
        ...item,
        sellerVerified: seller?.verified === true
      };
    });

  res.json(listings);
});

// Admin can see all listings
app.get("/api/admin/listings", requireAdmin, (req, res) => {
  res.json(readListings());
});

// Admin can approve or reject pending listings
app.patch("/api/admin/listings/:id/status", requireAdmin, (req, res) => {
  const { status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const listings = readListings();
  const item = listings.find(x => x.id === req.params.id);

  if (!item) {
    return res.status(404).json({ message: "Listing not found" });
  }

  if (item.status !== "pending") {
    return res.status(409).json({ message: "Listing is not pending" });
  }

  item.status = status;
  item.reviewedAt = new Date().toISOString();
  item.reviewedBy = req.session.user.id;

  fs.writeFileSync(LISTING_FILE, JSON.stringify(listings, null, 2));

  res.json({ message: "Listing " + status, listing: item });
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

      const listings = readListings();

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

      listings.push(listing);
      fs.writeFileSync(LISTING_FILE, JSON.stringify(listings, null, 2));

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

app.post("/api/inquiries", (req, res) => {
  if (!req.session.user || req.session.user.role !== "buyer") {
    return res.status(403).json({ message: "Buyer login required" });
  }

  const { listingId, message } = req.body;
  if (!listingId || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ message: "Machine and message required" });
  }

  const listing = readListings().find(item =>
    item.id === String(listingId) && item.status === "approved"
  );

  if (!listing) {
    return res.status(404).json({ message: "Approved machine not found" });
  }

  const inquiries = readInquiries();
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

  inquiries.push(inquiry);
  fs.writeFileSync(INQUIRY_FILE, JSON.stringify(inquiries, null, 2));

  res.json({ message: "Your inquiry has been sent to the seller." });
});

app.get("/api/seller/inquiries", (req, res) => {
  if (!req.session.user || req.session.user.role !== "seller") {
    return res.status(403).json({ message: "Seller login required" });
  }

  const inquiries = readInquiries().filter(item =>
    item.sellerId === req.session.user.id
  );

  res.json(inquiries);
});

app.get("/api/admin/inquiries", requireAdmin, (req, res) => {
  res.json(readInquiries());
});

app.listen(3000, "0.0.0.0", () => {
  console.log("BIHARI MART Server Running");
  console.log("Open http://localhost:3000");
});
