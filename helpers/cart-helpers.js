var db = require('../config/connection')
var collection = require('../config/collections')
const { ObjectId } = require('mongodb')

module.exports = {

  changeProductQuantity: (details) => {
    details.count = parseInt(details.count)
    details.quantity = parseInt(details.quantity)

    return new Promise((resolve, reject) => {
      if (details.count == -1 && details.quantity == 1) {
        // 🗑 Remove product if user clicks "decrement" at quantity 1
        db.get().collection(collection.CART_COLLECTION)
          .updateOne(
            { _id: new ObjectId(details.cart) },
            {
              $pull: { products: { item: new ObjectId(details.product) } }
            }
          ).then((response) => {
            resolve({ removeProduct: true })
          })
      } else {
        // 🔄 Update quantity
        db.get().collection(collection.CART_COLLECTION)
          .updateOne(
            {
              _id: new ObjectId(details.cart),
              'products.item': new ObjectId(details.product)
            },
            {
              $inc: { 'products.$.quantity': details.count }
            }
          ).then((response) => {
            resolve({ status: true })
          })
      }
    })
  },

  // Example: function to get total price after update
  getTotalAmount: (userId) => {
    return new Promise(async (resolve, reject) => {
      let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
        { $match: { user: new ObjectId(userId) } },
        { $unwind: '$products' },
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
            item: 1, quantity: 1,
            product: { $arrayElemAt: ['$product', 0] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ['$quantity', '$product.Price'] } }
          }
        }
      ]).toArray()

      resolve(total[0]?.total || 0)
    })
  }
}
