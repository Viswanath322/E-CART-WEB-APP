var db = require('../config/connection')
const collection = require('../config/collections')
const util = require('util')
const bcrypt = require('bcrypt')
const { promiseHooks } = require('v8')
const { pipeline } = require('stream')
const { log } = require('console')
const objId=require('mongodb').ObjectId
const crypto = require('crypto')
const razorpayInstance = require("../config/razorpay");  // adjust path if needed





module.exports = {
doSignup: (userData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // check confirm password
      if (userData.Password !== userData.confirm) {
        return reject('Passwords do not match')
      }

      // hash only the main password
      userData.Password = await bcrypt.hash(userData.Password, 10)

      // remove confirm field before saving
      delete userData.confirm

      // insert user
      const result = await db.get().collection(collection.USER_COLLECTION).insertOne(userData)

      // fetch the inserted user document
      const user = await db.get().collection(collection.USER_COLLECTION).findOne({ _id: result.insertedId })

      console.log(util.inspect(user, { showHidden: false, depth: null, colors: true }))
      resolve(user)   // ✅ return full user object, not insert result

    } catch (err) {
      reject(err)
    }
  })
},

  doLogin:(userData)=>{
    return new Promise(async(resolve,reject)=>{
        let loginstatus=false
        let response={}
        let user=await db.get().collection(collection.USER_COLLECTION).findOne({Email:userData.Email})
        if(user){
            bcrypt.compare(userData.Password,user.Password).then((status)=>{
                if(status){
                    console.log('success')
                    response.user=user
                    response.status=true
                    resolve(response)

                }else{
                    console.log('failed')
                    resolve({status:false})
                }
                
            })
        }else{
            console.log('no user')
            resolve({status:false})
        }
    })

  },
  addToCart: (proId, userId) => {
  let proObj = {
    item: new objId(proId),
    quantity: 1
  }

  

  return new Promise(async (resolve, reject) => {
    try {
      let userCart = await db.get().collection(collection.CART_COLLECTION)
                             .findOne({ user: new objId(userId) })

      if (userCart) {
        // check if product already exists
        let proExist = userCart.products.findIndex(product =>
          product.item.equals(new objId(proId))
        )

        if (proExist !== -1) {
          // product already in cart → increase quantity
          await db.get().collection(collection.CART_COLLECTION).updateOne(
            { user: new objId(userId), 'products.item': new objId(proId) },
            { $inc: { 'products.$.quantity': 1 } }
          )

          resolve({ status: true, message: "Quantity increased" })
        } else {
          // product not in cart → push new one
          await db.get().collection(collection.CART_COLLECTION).updateOne(
            { user: new objId(userId) },
            { $push: { products: proObj } }
          )

          resolve({ status: true, message: "Product added to cart" })
        }
      } else {
        // user has no cart → create new cart
        let cartobj = {
          user: new objId(userId),
          products: [proObj]
        }

        await db.get().collection(collection.CART_COLLECTION).insertOne(cartobj)

        resolve({ status: true, message: "Cart created and product added" })
      }
    } catch (err) {
      reject(err)
    }
  })
}
,getCartTotal: (userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      let total = 0;
      let cart = await db.get().collection(collection.CART_COLLECTION)
                         .findOne({ user: new objId(userId) });

      if (cart && cart.products.length > 0) {
        for (let item of cart.products) {
          let product = await db.get().collection(collection.PRODUCT_COLLECTION)
                                .findOne({ _id: new objId(item.item) });
          if (product) {
            total += item.quantity * parseFloat(product.Price);
          }
        }
      }

      resolve(total);
    } catch (err) {
      reject(err);
    }
  });
}
,
 

  getCartCount:(userId)=>{
    return new Promise(async(resolve,reject)=>{
      let count=0
      let cart=await db.get().collection(collection.CART_COLLECTION).findOne({user:new objId(userId)})
      if(cart){
        count=cart.products.length


      }
      resolve(count)
    })
  } ,
getCartProducts: (userId) => {
  return new Promise(async (resolve, reject) => {
    let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
      {
        $match: { user: new objId(userId) }
      },
      {
        $unwind: "$products"
      },
      {
        $project: {
          item: "$products.item",
          quantity: { 
            $convert: { input: "$products.quantity", to: "int", onError: 0, onNull: 0 }
          }
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
              { $convert: { input: "$product.Price", to: "int", onError: 0, onNull: 0 } }
            ]
          }
        }
      }
    ]).toArray()
    resolve(cartItems)
  })
},

updateQuantity: async (details) => {
  details.count = parseInt(details.count);
  details.quantity = parseInt(details.quantity);

  const cartId = new objId(details.cart);
  const productId = new objId(details.product);

  // ✅ Block decrement when qty is already 1
  if (details.count == -1 && details.quantity == 1) {
    return { blockDecrement: true }; // Don't remove, just block
  } else {
    // Update quantity
    await db.get().collection(collection.CART_COLLECTION).updateOne(
      { _id: cartId, "products.item": productId },
      { $inc: { "products.$.quantity": details.count } }
    );

    // Get updated product details
    let productDoc = await db.get().collection(collection.PRODUCT_COLLECTION)
      .findOne({ _id: productId });

    let price = productDoc ? parseFloat(productDoc.Price) : 0;

    // Get new quantity from cart
    let cart = await db.get().collection(collection.CART_COLLECTION)
      .findOne({ _id: cartId });

    let updatedProduct = cart.products.find(p => p.item.toString() === productId.toString());
    let newQuantity = updatedProduct ? updatedProduct.quantity : 0;

    let subtotal = newQuantity * price;

    // Recalculate cart total
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
    ]).toArray();

    let cartTotal = totalAgg.length > 0 ? totalAgg[0].total : 0;

    return { newQuantity, subtotal, total: cartTotal };
  }
}


,
getTotalAmount: (userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
        {
          $match: { user: new objId(userId) }
        },
        {
          $unwind: '$products'
        },
        {
          $project: {
            item: '$products.item',
            quantity: '$products.quantity'
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
            product: { $arrayElemAt: ['$product', 0] }
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: [
                  '$quantity',
                  { $toDouble: '$product.Price' }   // 👈 fix: convert string Price → number
                ]
              }
            }
          }
        }
      ]).toArray();

      console.log(total);

      resolve(total.length > 0 ? total[0].total : 0);
    } catch (err) {
      reject(err);
    }
  });
},

placeOrder: (orderData, userId, total) => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("📥 placeOrder called with:", { orderData, userId, total });

      let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objId(userId) });
      console.log("🛒 Cart found:", cart);

      if (!cart || !cart.products || cart.products.length === 0) {
        return reject("Cart is empty, cannot place order");
      }

      let orderObj = {
        deliveryDetails: orderData,
        userId: new objId(userId),
        paymentMethod: orderData['payment-method'],
        products: cart.products,
        totalAmount: total,
        status: orderData['payment-method'] === 'COD' ? 'Placed' : 'completed',
        date: new Date()
      };

      let result = await db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj);
      console.log("✅ Order inserted:", result.insertedId);

      // Clear cart after order
      await db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new objId(userId) });

      resolve(result.insertedId);

    } catch (err) {
      console.error("❌ placeOrder failed:", err);
      reject(err);
    }
  });
},

getUserOrders: (userId) => {
  return new Promise(async (resolve, reject) => {
    try {
      let orders = await db.get().collection(collection.ORDER_COLLECTION)
        .find({ userId: new objId(userId) })
        .toArray();
console.log("📦 Fetching orders for:", userId);

      resolve(orders);
    } catch (err) {
      reject(err);
    }
  });
},

generateRazorpay: (orderId, total) => {
    return new Promise((resolve, reject) => {
      const options = {
        amount: total *100,   // Razorpay expects paise
        currency: "INR",
        receipt: "" + orderId
      };

      razorpayInstance.orders.create(options, (err, order) => {
        if (err) {
          console.error("❌ Razorpay order creation failed:", err);
          reject(err);
        } else {
          console.log("✅ Razorpay order created:", order);
          resolve(order);
        }
      });
    });
  },


verifyPayment: (details) => {
  return new Promise(async (resolve, reject) => {
    try {
      let hmac = crypto.createHmac("sha256", "H5AQYMAJk7py6QWkx8eGtcv8");
      hmac.update(details.razorpay_order_id + "|" + details.razorpay_payment_id);
      hmac = hmac.digest("hex");

      if (hmac === details.razorpay_signature) {
        // ✅ Update DB to Success
        await db.get().collection(collection.ORDER_COLLECTION)
          .updateOne(
            { _id: new objId(details.receipt) },  // you passed orderId in receipt
            { $set: { paymentStatus: "Success" } }
          );

        resolve();
      } else {
        // ❌ Update DB to Failed
        await db.get().collection(collection.ORDER_COLLECTION)
          .updateOne(
            { _id: new objId(details.receipt) },
            { $set: { paymentStatus: "Failed" } }
          );

        reject("Payment verification failed");
      }
    } catch (err) {
      reject(err);
    }
  });
}

,

changePaymentStatus: (orderId) => {
  return new Promise((resolve, reject) => {
    db.get().collection(collection.ORDER_COLLECTION)
      .updateOne(
        { _id: new objId(orderId) },
        {
          $set: {
            paymentStatus: "Success"  // ✅ add or update this field
          }
        }
      )
      .then(() => resolve());
  });
}
,


updatePaymentStatus: (orderId) => {
  return new Promise((resolve, reject) => {
    db.get().collection(collection.ORDER_COLLECTION)
      .updateOne(
        { _id: new objId(orderId) },
        { $set: { paymentStatus: "SUCCESS" } }
      ).then(() => resolve());
  });
},

markPaymentFailed: (orderId) => {
  return new Promise((resolve, reject) => {
    db.get().collection(collection.ORDER_COLLECTION)
      .updateOne(
        { _id: new objId(orderId) },
        { $set: { paymentStatus: "FAILED" } }
      ).then(() => resolve());
  });
},

getUserOrders: (userId) => {
  return new Promise(async (resolve, reject) => {
    let orders = await db.get().collection(collection.ORDER_COLLECTION)
      .find({ userId: new objId(userId) })
      .sort({ date: -1 })
      .toArray();
    resolve(orders);
  });
}






}