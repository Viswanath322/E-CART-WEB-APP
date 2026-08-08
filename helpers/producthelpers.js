const { ObjectId } = require('mongodb')
var db = require('../config/connection')
let collection = require('../config/collections')

module.exports = {

  addProduct: (product, callback) => {
    db.get().collection(collection.PRODUCT_COLLECTION).insertOne(product).then((data) => {
      callback(data.insertedId)
    })
  },

  getAllProducts: (options = {}) => {
    return new Promise(async (resolve, reject) => {
      try {
        let query = {}
        if (options.category) {
          query.Category = { $regex: options.category, $options: 'i' }
        }

        let page = parseInt(options.page) || 1
        let limit = parseInt(options.limit) || 12
        let skip = (page - 1) * limit

        let products = await db.get().collection(collection.PRODUCT_COLLECTION)
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray()

        let total = await db.get().collection(collection.PRODUCT_COLLECTION).countDocuments(query)

        resolve({ products, total, page, limit, totalPages: Math.ceil(total / limit) })
      } catch (err) {
        reject(err)
      }
    })
  },

  getProductById: (proId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION)
        .findOne({ _id: new ObjectId(proId) })
        .then(product => resolve(product))
        .catch(err => reject(err))
    })
  },

  deleteProduct: (proId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION)
        .deleteOne({ _id: new ObjectId(proId) })
        .then(response => resolve(response))
        .catch(err => reject(err))
    })
  },

  getProductDetails: (proId) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION)
        .findOne({ _id: new ObjectId(proId) })
        .then(product => resolve(product))
        .catch(err => reject(err))
    })
  },

  updateProducts: (proId, proDetails) => {
    return new Promise((resolve, reject) => {
      db.get().collection(collection.PRODUCT_COLLECTION)
        .updateOne(
          { _id: new ObjectId(proId) },
          {
            $set: {
              Name: proDetails.Name,
              Description: proDetails.Description,
              Price: proDetails.Price,
              OldPrice: proDetails.OldPrice,
              Offer: proDetails.Offer,
              Category: proDetails.Category
            }
          }
        )
        .then(response => resolve(response))
        .catch(err => reject(err))
    })
  },

  getProductsBySearch: (query) => {
    return new Promise(async (resolve, reject) => {
      try {
        let products = await db.get().collection(collection.PRODUCT_COLLECTION)
          .find({ Name: { $regex: query, $options: "i" } })
          .toArray()
        resolve(products)
      } catch (err) {
        reject(err)
      }
    })
  },

  getCategories: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let categories = await db.get().collection(collection.PRODUCT_COLLECTION)
          .distinct('Category')
        resolve(categories.filter(Boolean))
      } catch (err) {
        reject(err)
      }
    })
  }

}
