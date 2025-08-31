var express = require('express');
var router = express.Router();
var db = require('../config/connection'); 
var productHelpers = require('../helpers/producthelpers');
const collection = require('../config/collections');
const objId = require('mongodb').ObjectId;
const razorpay = require("../config/razorpay");
const crypto = require("crypto");
var userhelpers = require('../helpers/userhelpers');

// 🔑 Middleware to check login
const verifyLogin = (req, res, next) => {
  if (req.session.user && req.session.user.loggedIn) {
    next();
  } else {
    res.redirect('/Login');
  }
};

/* =======================
   HOME PAGE
======================= */
router.get('/', verifyLogin,async function (req, res) {
  let user = req.session.user;
  let cartCount = null;

  if (user) {
    cartCount = await userhelpers.getCartCount(user._id);
  }

  let products = await productHelpers.getAllProducts();
  res.render('user/viewproducts', {
    isAdmin: false,
    products,
    user,
    cartCount
  });
});

/* =======================
   LOGIN & SIGNUP
======================= */
router.get('/Login', (req, res) => {
  if (req.session.user && req.session.user.loggedIn) {
    return res.redirect('/');
  }

  res.setHeader('Cache-Control', 'no-store'); 
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');   

  res.render('user/Login', { 'loginErr': req.session.user?.loginErr });
  req.session.user = { loggedIn: false }; // reset if not logged in
});

router.post('/Login', (req, res) => {
  userhelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.user = response.user;
      req.session.user.loggedIn = true;
      res.redirect('/');
    } else {
      req.session.user = { loginErr: "Invalid Email or Password", loggedIn: false };
      res.redirect('/Login');
    }
  });
});

router.get('/Signup', (req, res) => {
  res.render('user/Signup');
});

router.post('/Signup', (req, res) => {
  userhelpers.doSignup(req.body).then((response) => {
    req.session.user = response;
    req.session.user.loggedIn = true;
    res.redirect('/');
  }).catch((err) => {
    console.error("Signup error:", err);
    res.redirect('/Signup');
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

/* =======================
   CART
======================= */
router.get('/cart', verifyLogin, async (req, res) => {
  let cart = await db.get().collection(collection.CART_COLLECTION)
    .findOne({ user: new objId(req.session.user._id) });

  let products = await userhelpers.getCartProducts(req.session.user._id);
  let total = await userhelpers.getTotalAmount(req.session.user._id);

  res.render('user/cart', {
    user: req.session.user,
    products,
    cartId: cart ? cart._id : null,
    total
  });
});

router.get('/add-to-cart/:id', verifyLogin, (req, res) => {
  userhelpers.addToCart(req.params.id, req.session.user._id)
    .then(() => {
      res.json({ status: true, message: 'Product added to cart' });
    })
    .catch(() => {
      res.json({ status: false, message: 'Failed to add product' });
    });
});

router.post('/change-product-quantity', verifyLogin, async (req, res) => {
  try {
    req.body.userId = req.session.user._id;
    let response = await userhelpers.updateQuantity(req.body);
    res.json(response);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: true });
  }
});

/* =======================
   CHECKOUT + ORDERS
======================= */
router.get('/checkout', verifyLogin, async (req, res) => {
  try {
    let cartItems = await userhelpers.getCartProducts(req.session.user._id);
    let total = await userhelpers.getTotalAmount(req.session.user._id);

    res.render('user/checkout', { user: req.session.user, cartItems, total });
  } catch (err) {
    console.error(err);
    res.redirect('/cart');
  }
});

router.post('/order-success', verifyLogin, async (req, res) => {
  try {
    let total = await userhelpers.getTotalAmount(req.session.user._id);
    let orderId = await userhelpers.placeOrder(req.body, req.session.user._id, total);

    req.session.lastOrder = { orderId, total }; // store last order in session

    res.redirect('/order-success');
  } catch (err) {
    console.error("❌ Route error:", err);
    res.status(500).send("Error placing order: " + err.message);
  }
});

router.get('/order-success', verifyLogin, (req, res) => {
  let { orderId, total } = req.session.lastOrder || {};
  res.render("user/order-success", {
    orderId,
    total,
    user: req.session.user
  });
});

router.get('/view-orders', verifyLogin, async (req, res) => {
  try {
    let orders = await userhelpers.getUserOrders(req.session.user._id);
    res.render('user/view-orders', { 
      user: req.session.user,
      orders 
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).send("Error loading orders");
  }
});

/* =======================
   RAZORPAY
======================= */
router.post("/create-order", verifyLogin, async (req, res) => {
  try {
    let userId = req.session.user._id;
    let total = await userhelpers.getTotalAmount(userId);

    let orderId = await userhelpers.placeOrder(req.body, userId, total);
    let razorpayOrder = await userhelpers.generateRazorpay(orderId, total);

    res.json(razorpayOrder);
  } catch (err) {
    console.error("❌ Create order failed:", err);
    res.status(500).send("Order creation failed");
  }
});

router.post("/verify-payment", verifyLogin, (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const secret = "H5AQYMAJk7py6QWkx8eGtcv8"; // replace with process.env.RAZORPAY_SECRET
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      console.log("✅ Payment verified:", razorpay_payment_id);
      userhelpers.changePaymentStatus(orderId, "Success").then(() => {
        res.json({ status: true });
      });
    } else {
      console.log("❌ Signature mismatch");
      userhelpers.changePaymentStatus(orderId, "Failed").then(() => {
        res.json({ status: false });
      });
    }
  } catch (err) {
    console.error("❌ Payment verification error:", err);
    userhelpers.changePaymentStatus(req.body.orderId, "Failed").then(() => {
      res.json({ status: false });
    });
  }
});


// Live search API (returns JSON)
router.get('/api/search', async (req, res) => {
  let query = req.query.q || '';

  try {
    let products = await db.get().collection('product').find({
      Name: { $regex: query, $options: 'i' }  // ✅ must match "Name"
    }).toArray();

    res.json(products);  // ✅ return JSON for AJAX
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});




module.exports = router;
