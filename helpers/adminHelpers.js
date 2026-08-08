require('dotenv').config()
var db = require('../config/connection')
const collection = require('../config/collections')
const bcrypt = require('bcrypt')
const objId = require('mongodb').ObjectId

module.exports = {

  doLogin: (adminData) => {
    return new Promise(async (resolve, reject) => {
      let response = {}
      const email = adminData.Email || adminData.email
      const password = adminData.Password || adminData.password

      let admin = await db.get().collection(collection.ADMIN_COLLECTION)
        .findOne({ Email: email })

      if (admin) {
        bcrypt.compare(password, admin.Password).then((status) => {
          if (status) {
            response.admin = admin
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

  getDashboardStats: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let totalProducts = await db.get().collection(collection.PRODUCT_COLLECTION).countDocuments()
        let totalUsers = await db.get().collection(collection.USER_COLLECTION).countDocuments()
        let totalOrders = await db.get().collection(collection.ORDER_COLLECTION).countDocuments()

        let revenueAgg = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
          { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]).toArray()

        let totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0

        let recentOrders = await db.get().collection(collection.ORDER_COLLECTION)
          .find().sort({ date: -1 }).limit(5).toArray()

        // Orders by status counts
        let statusAgg = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } }
        ]).toArray()

        let ordersByStatus = {}
        statusAgg.forEach(s => { ordersByStatus[s._id] = s.count })

        resolve({ totalProducts, totalUsers, totalOrders, totalRevenue, recentOrders, ordersByStatus })
      } catch (err) {
        reject(err)
      }
    })
  },

  getAllOrders: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let orders = await db.get().collection(collection.ORDER_COLLECTION)
          .find().sort({ date: -1 }).toArray()
        resolve(orders)
      } catch (err) {
        reject(err)
      }
    })
  },

  updateOrderStatus: (orderId, status) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.get().collection(collection.ORDER_COLLECTION).updateOne(
          { _id: new objId(orderId) },
          { $set: { status: status } }
        )
        resolve()
      } catch (err) {
        reject(err)
      }
    })
  },

  getAllUsers: () => {
    return new Promise(async (resolve, reject) => {
      try {
        let users = await db.get().collection(collection.USER_COLLECTION)
          .find({}, { projection: { Password: 0 } })
          .sort({ _id: -1 })
          .toArray()
        resolve(users)
      } catch (err) {
        reject(err)
      }
    })
  }

}
