var express = require('express')
var router = express.Router()
var db = require('../config/connection')
var productHelpers = require('../helpers/producthelpers')
const collection = require('../config/collections')
const objId = require('mongodb').ObjectId
const razorpay = require("../config/razorpay")
const crypto = require("crypto")
var userhelpers = require('../helpers/userhelpers')

// ─── Auth Middleware ────────────────────────────────────────────
const verifyLogin = (req, res, next) => {
  if (req.session.user && req.session.user.loggedIn) {
    next()
  } else {
    res.redirect('/Login')
  }
}

/* ─────────────── HOME / PRODUCTS ─────────────────────────────── */
router.get('/', verifyLogin, async function (req, res) {
  let user = req.session.user
  let cartCount = null

  if (user) {
    cartCount = await userhelpers.getCartCount(user._id)
  }

  let category = req.query.category || ''
  let page = parseInt(req.query.page) || 1

  let result = await productHelpers.getAllProducts({ category, page, limit: 12 })
  let categories = await productHelpers.getCategories()

  res.render('user/viewproducts', {
    isAdmin: false,
    products: result.products,
    categories,
    selectedCategory: category,
    currentPage: result.page,
    totalPages: result.totalPages,
    cartCount,
    user
  })
})

/* ─────────────── PRODUCT DETAIL ──────────────────────────────── */
router.get('/product/:id', verifyLogin, async (req, res) => {
  try {
    let product = await productHelpers.getProductById(req.params.id)
    let cartCount = await userhelpers.getCartCount(req.session.user._id)
    res.render('user/product-detail', { product, user: req.session.user, cartCount })
  } catch (err) {
    console.error(err)
    res.redirect('/')
  }
})

/* ─────────────── LOGIN & SIGNUP ──────────────────────────────── */
router.get('/Login', (req, res) => {
  if (req.session.user && req.session.user.loggedIn) {
    return res.redirect('/')
  }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.render('user/Login', { loginErr: req.session.user?.loginErr })
  req.session.user = { loggedIn: false }
})

router.post('/Login', (req, res) => {
  userhelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.user = response.user
      req.session.user.loggedIn = true
      res.redirect('/')
    } else {
      req.session.user = { loginErr: "Invalid Email or Password", loggedIn: false }
      res.redirect('/Login')
    }
  })
})

router.get('/Signup', (req, res) => {
  if (req.session.user && req.session.user.loggedIn) {
    return res.redirect('/')
  }
  res.render('user/Signup')
})

router.post('/Signup', (req, res) => {
  userhelpers.doSignup(req.body).then((response) => {
    req.session.user = response
    req.session.user.loggedIn = true
    res.redirect('/')
  }).catch((err) => {
    console.error("Signup error:", err)
    res.redirect('/Signup')
  })
})

// Fixed: redirect to /Login (capital L) to match the route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err)
      return res.redirect('/')
    }
    res.clearCookie('connect.sid')
    res.redirect('/Login')
  })
})

/* ─────────────── CART ─────────────────────────────────────────── */
router.get('/cart', verifyLogin, async (req, res) => {
  let cart = await db.get().collection(collection.CART_COLLECTION)
    .findOne({ user: new objId(req.session.user._id) })

  let products = await userhelpers.getCartProducts(req.session.user._id)
  let total = await userhelpers.getTotalAmount(req.session.user._id)
  let cartCount = products.length

  res.render('user/cart', {
    user: req.session.user,
    products,
    cartId: cart ? cart._id : null,
    total,
    cartCount
  })
})

router.get('/add-to-cart/:id', verifyLogin, (req, res) => {
  userhelpers.addToCart(req.params.id, req.session.user._id)
    .then(async () => {
      let cartCount = await userhelpers.getCartCount(req.session.user._id)
      res.json({ status: true, cartCount })
    })
    .catch(() => {
      res.json({ status: false, message: 'Failed to add product' })
    })
})

router.post('/change-product-quantity', verifyLogin, async (req, res) => {
  try {
    req.body.userId = req.session.user._id
    let response = await userhelpers.updateQuantity(req.body)
    res.json(response)
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: true })
  }
})

// Fixed: Added remove-from-cart route that was missing
router.post('/remove-from-cart', verifyLogin, async (req, res) => {
  try {
    let { cartId, productId } = req.body
    await userhelpers.removeFromCart(cartId, productId)
    let total = await userhelpers.getTotalAmount(req.session.user._id)
    let cartCount = await userhelpers.getCartCount(req.session.user._id)
    res.json({ status: true, total, cartCount })
  } catch (err) {
    console.error(err)
    res.json({ status: false })
  }
})

/* ─────────────── WISHLIST ─────────────────────────────────────── */
router.get('/wishlist', verifyLogin, async (req, res) => {
  try {
    let products = await userhelpers.getWishlistProducts(req.session.user._id)
    let cartCount = await userhelpers.getCartCount(req.session.user._id)
    res.render('user/wishlist', { user: req.session.user, products, cartCount })
  } catch (err) {
    console.error(err)
    res.redirect('/')
  }
})

router.get('/add-to-wishlist/:id', verifyLogin, async (req, res) => {
  try {
    let result = await userhelpers.addToWishlist(req.params.id, req.session.user._id)
    res.json(result)
  } catch (err) {
    res.json({ status: false })
  }
})

router.post('/remove-from-wishlist', verifyLogin, async (req, res) => {
  try {
    await userhelpers.removeFromWishlist(req.body.productId, req.session.user._id)
    res.json({ status: true })
  } catch (err) {
    res.json({ status: false })
  }
})

/* ─────────────── PROFILE ──────────────────────────────────────── */
router.get('/profile', verifyLogin, async (req, res) => {
  try {
    let user = await userhelpers.getUserById(req.session.user._id)
    let cartCount = await userhelpers.getCartCount(req.session.user._id)
    res.render('user/profile', { user, cartCount })
  } catch (err) {
    console.error(err)
    res.redirect('/')
  }
})

router.post('/profile', verifyLogin, async (req, res) => {
  try {
    await userhelpers.updateProfile(req.session.user._id, req.body)
    // Update session user name
    if (req.body.name) req.session.user.name = req.body.name
    res.json({ status: true, message: 'Profile updated successfully' })
  } catch (err) {
    res.json({ status: false, message: 'Update failed' })
  }
})

/* ─────────────── CHECKOUT + ORDERS ────────────────────────────── */
router.get('/checkout', verifyLogin, async (req, res) => {
  try {
    let cartItems = await userhelpers.getCartProducts(req.session.user._id)
    let total = await userhelpers.getTotalAmount(req.session.user._id)
    let cartCount = cartItems.length

    res.render('user/checkout', { user: req.session.user, cartItems, total, cartCount })
  } catch (err) {
    console.error(err)
    res.redirect('/cart')
  }
})

router.post('/order-success', verifyLogin, async (req, res) => {
  try {
    let total = await userhelpers.getTotalAmount(req.session.user._id)
    let orderId = await userhelpers.placeOrder(req.body, req.session.user._id, total)
    req.session.lastOrder = { orderId, total }
    res.redirect('/order-success')
  } catch (err) {
    console.error("❌ Route error:", err)
    if (err === "Cart is empty, cannot place order") {
      return res.redirect('/cart')
    }
    res.status(500).send("Error placing order: " + err.message)
  }
})

router.get('/order-success', verifyLogin, (req, res) => {
  let { orderId, total } = req.session.lastOrder || {}
  res.render("user/order-success", { orderId, total, user: req.session.user })
})

router.get('/view-orders', verifyLogin, async (req, res) => {
  try {
    let orders = await userhelpers.getUserOrders(req.session.user._id)
    let cartCount = await userhelpers.getCartCount(req.session.user._id)
    res.render('user/view-orders', { user: req.session.user, orders, cartCount })
  } catch (err) {
    console.error("❌ Error fetching orders:", err)
    res.status(500).send("Error loading orders")
  }
})

/* ─────────────── RAZORPAY ─────────────────────────────────────── */
router.post("/create-order", verifyLogin, async (req, res) => {
  try {
    let userId = req.session.user._id
    let total = await userhelpers.getTotalAmount(userId)
    let orderId = await userhelpers.placeOrder(req.body, userId, total)
    let razorpayOrder = await userhelpers.generateRazorpay(orderId, total)
    res.json({ ...razorpayOrder, orderId })
  } catch (err) {
    console.error("❌ Create order failed:", err)
    if (err === "Cart is empty, cannot place order") {
      return res.status(400).json({ error: "Your cart is empty. Please add items to checkout." })
    }
    res.status(500).send("Order creation failed")
  }
})

router.post("/verify-payment", verifyLogin, (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body
    const secret = process.env.RAZORPAY_KEY_SECRET
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id)
    const generatedSignature = hmac.digest("hex")

    if (generatedSignature === razorpay_signature) {
      userhelpers.changePaymentStatus(orderId, "Success").then(() => {
        userhelpers.clearCart(req.session.user._id).then(() => {
          res.json({ status: true })
        })
      })
    } else {
      userhelpers.changePaymentStatus(orderId, "Failed").then(() => {
        res.json({ status: false })
      })
    }
  } catch (err) {
    console.error("❌ Payment verification error:", err)
    userhelpers.changePaymentStatus(req.body.orderId, "Failed").then(() => {
      res.json({ status: false })
    })
  }
})

/* ─────────────── SEARCH API ───────────────────────────────────── */
router.get('/api/search', async (req, res) => {
  let query = req.query.q || ''
  try {
    let products = await db.get().collection('product').find({
      Name: { $regex: query, $options: 'i' }
    }).limit(8).toArray()
    res.json(products)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Search failed' })
  }
})

module.exports = router
