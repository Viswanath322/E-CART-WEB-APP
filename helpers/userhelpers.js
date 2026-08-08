require('dotenv').config()
var db = require('../config/connection')
const collection = require('../config/collections')
const bcrypt = require('bcrypt')
const objId = require('mongodb').ObjectId
const crypto = require('crypto')
const razorpayInstance = require("../config/razorpay")

module.exports = {

  /* ─────────────────────────── AUTH ─────────────────────────── */

  doSignup: (userData) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (userData.Password !== userData.confirm) {
          return reject('Passwords do not match')
        }
        userData.Password = await bcrypt.hash(userData.Password, 10)
        delete userData.confirm

        const result = await db.get().collection(collection.USER_COLLECTION).insertOne(userData)
        const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: result.insertedId })
        resolve(user)
      } catch (err) {
        reject(err)
      }
    })
  },

  doLogin: (userData) => {
    return new Promise(async (resolve, reject) => {
      let response = {}
      let user = await db.get().collection(collection.USER_COLLECTION).findOne({
        $or: [
          { Email: userData.Email },
          { email: userData.Email }
        ]
      })
      if (user) {
        bcrypt.compare(userData.Password, user.Password).then((status) => {
          if (status) {
            // Normalize old accounts that used lowercase 'email'
            if (user.email && !user.Email) {
              user.Email = user.email;
            }
            response.user = user
            response.status = true
            resolve(response)
          } else {
            resolve({ status: false })
          }
        })
      } else {
        resolve({ status: false })
      }
    })
  },

  /* ─────────────────────────── CART ─────────────────────────── */

  addToCart: (proId, userId) => {
    let proObj = { item: new objId(proId), quantity: 1 }

    return new Promise(async (resolve, reject) => {
      try {
        let userCart = await db.get().collection(collection.CART_COLLECTION)
          .findOne({ user: new objId(userId) })

        if (userCart) {
          let proExist = userCart.products.findIndex(p => p.item.equals(new objId(proId)))

          if (proExist !== -1) {
            await db.get().collection(collection.CART_COLLECTION).updateOne(
              { user: new objId(userId), 'products.item': new objId(proId) },
              { $inc: { 'products.$.quantity': 1 } }
            )
            resolve({ status: true, message: "Quantity increased" })
          } else {
            await db.get().collection(collection.CART_COLLECTION).updateOne(
              { user: new objId(userId) },
              { $push: { products: proObj } }
            )
            resolve({ status: true, message: "Product added to cart" })
          }
        } else {
          await db.get().collection(collection.CART_COLLECTION).insertOne({
            user: new objId(userId),
            products: [proObj]
          })
          resolve({ status: true, message: "Cart created and product added" })
        }
      } catch (err) {
        reject(err)
      }
    })
  },

  removeFromCart: (cartId, productId) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.get().collection(collection.CART_COLLECTION).updateOne(
          { _id: new objId(cartId) },
          { $pull: { products: { item: new objId(productId) } } }
        )
        resolve({ status: true })
      } catch (err) {
        reject(err)
      }
    })
  },

  getCartCount: (userId) => {
    return new Promise(async (resolve, reject) => {
      let count = 0
      let cart = await db.get().collection(collection.CART_COLLECTION)
        .findOne({ user: new objId(userId) })
      if (cart) count = cart.products.length
      resolve(count)
    })
  },

  getCartProducts: (userId) => {
    return new Promise(async (resolve, reject) => {
      let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
        { $match: { user: new objId(userId) } },
        { $unwind: "$products" },
        {
          $project: {
            item: "$products.item",
            quantity: { $convert: { input: "$products.quantity", to: "int", onError: 0, onNull: 0 } }
          }
        },
        {
          $lookup: {
            from: collection.PRODUCT_COLLECTION,
            localField: 'item',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $project: {
            item: 1,
            quantity: 1,
            product: { $arrayElemAt: ['$product', 0] },
            subTotal: {
              $multiply: [
                { $convert: { input: "$quantity", to: "int", onError: 0, onNull: 0 } },
                { $convert: { input: { $arrayElemAt: ["$product.Price", 0] }, to: "double", onError: 0, onNull: 0 } }
              ]
            }
          }
        }
      ]).toArray()
      resolve(cartItems)
    })
  },

  updateQuantity: async (details) => {
    details.count = parseInt(details.count)
    details.quantity = parseInt(details.quantity)

    const cartId = new objId(details.cart)
    const productId = new objId(details.product)

    if (details.count === -1 && details.quantity === 1) {
      return { blockDecrement: true }
    }

    await db.get().collection(collection.CART_COLLECTION).updateOne(
      { _id: cartId, "products.item": productId },
      { $inc: { "products.$.quantity": details.count } }
    )

    let productDoc = await db.get().collection(collection.PRODUCT_COLLECTION).findOne({ _id: productId })
    let price = productDoc ? parseFloat(productDoc.Price) : 0

    let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ _id: cartId })
    let updatedProduct = cart.products.find(p => p.item.toString() === productId.toString())
    let newQuantity = updatedProduct ? updatedProduct.quantity : 0
    let subtotal = newQuantity * price

    let totalAgg = await db.get().collection(collection.CART_COLLECTION).aggregate([
      { $match: { _id: cartId } },
      { $unwind: "$products" },
      {
        $lookup: {
          from: collection.PRODUCT_COLLECTION,
          localField: "products.item",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ["$products.quantity", { $toDouble: "$product.Price" }] } }
        }
      }
    ]).toArray()

    let cartTotal = totalAgg.length > 0 ? totalAgg[0].total : 0
    return { newQuantity, subtotal, total: cartTotal }
  },

  getTotalAmount: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
          { $match: { user: new objId(userId) } },
          { $unwind: '$products' },
          { $project: { item: '$products.item', quantity: '$products.quantity' } },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: 'item',
              foreignField: '_id',
              as: 'product'
            }
          },
          { $project: { item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] } } },
          {
            $group: {
              _id: null,
              total: { $sum: { $multiply: ['$quantity', { $toDouble: '$product.Price' }] } }
            }
          }
        ]).toArray()

        resolve(total.length > 0 ? total[0].total : 0)
      } catch (err) {
        reject(err)
      }
    })
  },

  /* ─────────────────────────── ORDERS ─────────────────────────── */

  placeOrder: (orderData, userId, total) => {
    return new Promise(async (resolve, reject) => {
      try {
        let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objId(userId) })

        if (!cart || !cart.products || cart.products.length === 0) {
          return reject("Cart is empty, cannot place order")
        }

        let orderObj = {
          deliveryDetails: orderData,
          userId: new objId(userId),
          paymentMethod: orderData['payment-method'],
          products: cart.products,
          totalAmount: total,
          status: 'Placed',
          paymentStatus: orderData['payment-method'] === 'COD' ? 'Pending (COD)' : 'Pending',
          date: new Date()
        }

        let result = await db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj)
        if (orderObj.paymentMethod === 'COD') {
          await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new objId(userId) })
        }
        resolve(result.insertedId)
      } catch (err) {
        reject(err)
      }
    })
  },

  clearCart: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new objId(userId) })
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  },

  getUserOrders: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let orders = await db.get().collection(collection.ORDER_COLLECTION)
          .find({ userId: new objId(userId) })
          .sort({ date: -1 })
          .toArray()
        resolve(orders)
      } catch (err) {
        reject(err)
      }
    })
  },

  /* ─────────────────────────── RAZORPAY ─────────────────────────── */

  generateRazorpay: (orderId, total) => {
    return new Promise((resolve, reject) => {
      const options = {
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: "" + orderId
      }

      razorpayInstance.orders.create(options, (err, order) => {
        if (err) {
          console.error("❌ Razorpay order creation failed:", err)
          reject(err)
        } else {
          console.log("✅ Razorpay order created:", order)
          resolve(order)
        }
      })
    })
  },

  // Fixed: now properly updates status to either "Success" or "Failed"
  changePaymentStatus: (orderId, status) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.ORDER_COLLECTION)
        .updateOne(
          { _id: new objId(orderId) },
          { $set: { paymentStatus: status || "Success" } }
        )
        .then(() => resolve())
        .catch(err => reject(err))
    })
  },

  /* ─────────────────────────── WISHLIST ─────────────────────────── */

  addToWishlist: (proId, userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let wishlist = await db.get().collection(collection.WISHLIST_COLLECTION)
          .findOne({ user: new objId(userId) })

        if (wishlist) {
          let exists = wishlist.products.some(p => p.toString() === proId)
          if (exists) {
            resolve({ status: true, message: "Already in wishlist" })
          } else {
            await db.get().collection(collection.WISHLIST_COLLECTION).updateOne(
              { user: new objId(userId) },
              { $push: { products: new objId(proId) } }
            )
            resolve({ status: true, message: "Added to wishlist" })
          }
        } else {
          await db.get().collection(collection.WISHLIST_COLLECTION).insertOne({
            user: new objId(userId),
            products: [new objId(proId)]
          })
          resolve({ status: true, message: "Added to wishlist" })
        }
      } catch (err) {
        reject(err)
      }
    })
  },

  removeFromWishlist: (proId, userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.get().collection(collection.WISHLIST_COLLECTION).updateOne(
          { user: new objId(userId) },
          { $pull: { products: new objId(proId) } }
        )
        resolve({ status: true })
      } catch (err) {
        reject(err)
      }
    })
  },

  getWishlistProducts: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let result = await db.get().collection(collection.WISHLIST_COLLECTION).aggregate([
          { $match: { user: new objId(userId) } },
          { $unwind: "$products" },
          {
            $lookup: {
              from: collection.PRODUCT_COLLECTION,
              localField: "products",
              foreignField: "_id",
              as: "product"
            }
          },
          { $project: { product: { $arrayElemAt: ["$product", 0] } } }
        ]).toArray()

        resolve(result.map(r => r.product).filter(Boolean))
      } catch (err) {
        reject(err)
      }
    })
  },

  /* ─────────────────────────── PROFILE ─────────────────────────── */

  getUserById: (userId) => {
    return new Promise(async (resolve, reject) => {
      try {
        let user = await db.get().collection(collection.USER_COLLECTION)
          .findOne({ _id: new objId(userId) })
        resolve(user)
      } catch (err) {
        reject(err)
      }
    })
  },

  updateProfile: (userId, data) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.get().collection(collection.USER_COLLECTION).updateOne(
          { _id: new objId(userId) },
          { $set: { name: data.name, Phone: data.Phone, Address: data.Address } }
        )
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  }

}