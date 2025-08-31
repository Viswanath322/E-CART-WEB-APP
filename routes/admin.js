var express = require('express');
var router = express.Router();
var productHelpers = require('../helpers/producthelpers');
var adminHelpers = require('../helpers/adminHelpers');

// ✅ Middleware
function verifyAdminLogin(req, res, next) {
  if (req.session.admin && req.session.admin.loggedIn) {
    next();
  } else {
    res.redirect('/admin/Login');
  }
}

/* GET products list (protected) */
router.get('/', verifyAdminLogin, function (req, res) {
  productHelpers.getAllProducts().then((products) => {
    res.render('admin/viewproducts', {
       isAdmin: true,
       admin:req.session.admin,
        products 
      });
  });
});

/* ✅ Login Page (NOT protected) */
router.get('/Login', (req, res) => {
  if (req.session.admin?.loggedIn) {
    return res.redirect('/admin');
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let loginErr = req.session.admin?.loginErr;
  req.session.admin = null;
  res.render('admin/Login', { loginErr });
});

/* ✅ Login POST (NOT protected) */
router.post('/Login', (req, res) => {
  adminHelpers.doLogin(req.body).then((response) => {
    if (response.status) {
      req.session.admin = response.admin;
      req.session.admin.loggedIn = true;
      res.redirect('/admin');
    } else {
      req.session.admin = { loginErr: "Invalid Email or Password", loggedIn: false };
      res.redirect('/admin/Login');
    }
  });
});

/* Protected Routes */
router.get('/addproducts', verifyAdminLogin, function (req, res) {
  res.render('admin/addproducts', { layout: 'admin-layout', isAdmin: true });
});


router.post('/addproducts', verifyAdminLogin, (req, res) => {
  productHelpers.addProduct(req.body, (id) => {
    let image = req.files.image;
    image.mv('./public/productimages/' + id + '.jpg', (err) => {
      if (!err) {
        res.render('admin/addproducts');
      } else {
        console.log(err);
      }
    });
  });
});

router.get('/deleteproduct/:id', verifyAdminLogin, (req, res) => {
  let proId = req.params.id;
  productHelpers.deleteProduct(proId).then(() => {
    res.redirect('/admin');
  });
});

router.get('/editproduct/:id', verifyAdminLogin, async (req, res) => {
  let product = await productHelpers.getProductDetails(req.params.id);
  res.render('admin/editproduct', {
     product ,
    layout: 'admin-layout'
  });
});

router.post('/editproduct/:id', verifyAdminLogin, (req, res) => {
  productHelpers.updateProducts(req.params.id, req.body).then(() => {
    if (req.files && req.files.image) {
      let image = req.files.image;
      let id = req.params.id;

      image.mv('./public/productimages/' + id + '.jpg', (err) => {
        if (err) {
          console.log("Image upload failed:", err);
        }
        res.redirect('/admin');
      });
    } else {
      res.redirect('/admin');
    }
  }).catch(err => {
    console.error("Update failed:", err);
    res.redirect('/admin');
  });
});

/* ✅ Logout route */
router.get('/logout', (req, res) => {
  req.session.admin = null;
  res.redirect('/admin/Login');
});




// routes/admin.js

router.get('/search', verifyAdminLogin, async (req, res) => {
  try {
    let query = req.query.q;   // 👈 comes from ?q= in URL
    let products = await productHelpers.getProductsBySearch(query);

    res.render('admin/viewproducts', { 
      isAdmin: true, 
      admin: req.session.admin,
      products,
      searchQuery: query,
    });
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});


module.exports = router;
