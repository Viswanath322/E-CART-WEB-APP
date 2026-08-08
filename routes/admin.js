var express = require('express')
var router = express.Router()
var productHelpers = require('../helpers/producthelpers')
var adminHelpers = require('../helpers/adminHelpers')

// ─── Auth Middleware ────────────────────────────────────────────
function verifyAdminLogin(req, res, next) {
  if (req.session.admin && req.session.admin.loggedIn) {
    next()
  } else {
    res.redirect('/admin/Login')
  }
}

/* ─────────────── DASHBOARD ────────────────────────────────────── */
router.get('/', verifyAdminLogin, async function (req, res) {
  try {
    let stats = await adminHelpers.getDashboardStats()
    res.render('admin/dashboard', {
      isAdmin: true,
      layout: 'admin-layout',
      admin: req.session.admin,
      pageTitle: 'Dashboard',
      isDashboard: true,
      ...stats
    })
  } catch (err) {
    console.error(err)
    res.redirect('/admin/Login')
  }
})

/* ─────────────── LOGIN ─────────────────────────────────────────── */
router.get('/Login', (req, res) => {
  if (req.session.admin?.loggedIn) {
    return res.redirect('/admin')
  }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  let loginErr = req.session.admin?.loginErr
  req.session.admin = null
  res.render('admin/login', { loginErr, layout: 'admin-layout' })
})

router.post('/Login', (req, res) => {
  adminHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.admin = response.admin
      req.session.admin.loggedIn = true
      res.redirect('/admin')
    } else {
      req.session.admin = { loginErr: "Invalid Email or Password", loggedIn: false }
      res.redirect('/admin/Login')
    }
  })
})

router.get('/logout', (req, res) => {
  req.session.admin = null
  res.redirect('/admin/Login')
})

/* ─────────────── PRODUCTS ──────────────────────────────────────── */
router.get('/products', verifyAdminLogin, async function (req, res) {
  try {
    let result = await productHelpers.getAllProducts({ page: req.query.page || 1, limit: 20 })
    res.render('admin/viewproducts', {
      isAdmin: true,
      layout: 'admin-layout',
      admin: req.session.admin,
      pageTitle: 'Products',
      isProducts: true,
      products: result.products,
      currentPage: result.page,
      totalPages: result.totalPages
    })
  } catch (err) {
    console.error(err)
    res.redirect('/admin')
  }
})

router.get('/addproducts', verifyAdminLogin, function (req, res) {
  res.render('admin/addproducts', { layout: 'admin-layout', isAdmin: true, pageTitle: 'Add Product', isProducts: true, admin: req.session.admin })
})

router.post('/addproducts', verifyAdminLogin, (req, res) => {
  productHelpers.addProduct(req.body, (id) => {
    if (req.files && req.files.image) {
      let image = req.files.image
      image.mv('./public/productimages/' + id + '.jpg', (err) => {
        if (err) console.log("Image upload error:", err)
        res.redirect('/admin/products')
      })
    } else {
      res.redirect('/admin/products')
    }
  })
})

router.get('/deleteproduct/:id', verifyAdminLogin, (req, res) => {
  productHelpers.deleteProduct(req.params.id).then(() => {
    res.redirect('/admin/products')
  })
})

router.get('/editproduct/:id', verifyAdminLogin, async (req, res) => {
  let product = await productHelpers.getProductDetails(req.params.id)
  res.render('admin/editproduct', { product, layout: 'admin-layout', isAdmin: true, pageTitle: 'Edit Product', isProducts: true, admin: req.session.admin })
})

router.post('/editproduct/:id', verifyAdminLogin, (req, res) => {
  productHelpers.updateProducts(req.params.id, req.body).then(() => {
    if (req.files && req.files.image) {
      let image = req.files.image
      image.mv('./public/productimages/' + req.params.id + '.jpg', (err) => {
        if (err) console.log("Image upload failed:", err)
        res.redirect('/admin/products')
      })
    } else {
      res.redirect('/admin/products')
    }
  }).catch(err => {
    console.error("Update failed:", err)
    res.redirect('/admin/products')
  })
})

router.get('/search', verifyAdminLogin, async (req, res) => {
  try {
    let products = await productHelpers.getProductsBySearch(req.query.q || '')
    res.render('admin/viewproducts', {
      isAdmin: true,
      layout: 'admin-layout',
      admin: req.session.admin,
      products,
      searchQuery: req.query.q
    })
  } catch (err) {
    console.error(err)
    res.redirect('/admin/products')
  }
})

/* ─────────────── ORDERS ────────────────────────────────────────── */
router.get('/orders', verifyAdminLogin, async (req, res) => {
  try {
    let orders = await adminHelpers.getAllOrders()
    res.render('admin/orders', {
      isAdmin: true,
      layout: 'admin-layout',
      admin: req.session.admin,
      pageTitle: 'Orders',
      isOrders: true,
      orders
    })
  } catch (err) {
    console.error(err)
    res.redirect('/admin')
  }
})

router.post('/update-order-status/:id', verifyAdminLogin, async (req, res) => {
  try {
    await adminHelpers.updateOrderStatus(req.params.id, req.body.status)
    res.json({ status: true })
  } catch (err) {
    res.json({ status: false })
  }
})

/* ─────────────── USERS ─────────────────────────────────────────── */
router.get('/users', verifyAdminLogin, async (req, res) => {
  try {
    let users = await adminHelpers.getAllUsers()
    res.render('admin/users', {
      isAdmin: true,
      layout: 'admin-layout',
      admin: req.session.admin,
      pageTitle: 'Users',
      isUsers: true,
      users
    })
  } catch (err) {
    console.error(err)
    res.redirect('/admin')
  }
})

module.exports = router
