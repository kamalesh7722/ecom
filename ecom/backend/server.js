// ================================
// IMPORTS
// ================================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================================
// APP CONFIG
// ================================
const app = express();
app.use(express.json());
app.use(cors());

const PORT = 5000;
const JWT_SECRET = "secretkey123"; // change in production

// ================================
// MONGODB CONNECTION
// ================================
mongoose
  .connect("mongodb://127.0.0.1:27017/solestyle")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error(err));

// ================================
// SCHEMAS & MODELS
// ================================

// User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});
const User = mongoose.model("User", UserSchema);

// Product Schema
const ProductSchema = new mongoose.Schema({
  name: String,
  brand: String,
  price: Number,
  image: String,
  category: String,
});
const Product = mongoose.model("Product", ProductSchema);

// Cart Schema
const CartSchema = new mongoose.Schema({
  userId: String,
  items: [
    {
      productId: String,
      quantity: Number,
    },
  ],
});
const Cart = mongoose.model("Cart", CartSchema);

// ================================
// AUTH MIDDLEWARE
// ================================
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ================================
// AUTH ROUTES
// ================================

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name,
      email,
      password: hashedPassword,
    });
    res.json({ message: "User registered" });
  } catch {
    res.status(400).json({ message: "User already exists" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.status(400).json({ message: "Invalid password" });

  const token = jwt.sign({ id: user._id }, JWT_SECRET, {
    expiresIn: "1h",
  });

  res.json({ token });
});

// ================================
// PRODUCT ROUTES
// ================================

// Add Product
app.post("/api/products", async (req, res) => {
  const product = await Product.create(req.body);
  res.json(product);
});

// Get Products
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// ================================
// CART ROUTES (Protected)
// ================================

// Get Cart
app.get("/api/cart", authMiddleware, async (req, res) => {
  let cart = await Cart.findOne({ userId: req.user.id });
  if (!cart) {
    cart = await Cart.create({ userId: req.user.id, items: [] });
  }
  res.json(cart);
});

// Add to Cart
app.post("/api/cart", authMiddleware, async (req, res) => {
  const { productId } = req.body;

  let cart = await Cart.findOne({ userId: req.user.id });

  if (!cart) {
    cart = await Cart.create({
      userId: req.user.id,
      items: [{ productId, quantity: 1 }],
    });
  } else {
    const item = cart.items.find((i) => i.productId === productId);
    if (item) item.quantity++;
    else cart.items.push({ productId, quantity: 1 });
    await cart.save();
  }

  res.json(cart);
});

// Remove from Cart
app.delete("/api/cart/:productId", authMiddleware, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id });
  cart.items = cart.items.filter(
    (i) => i.productId !== req.params.productId
  );
  await cart.save();
  res.json(cart);
});

// ================================
// SERVER START
// ================================
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

