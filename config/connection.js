require('dotenv').config()
const { MongoClient } = require('mongodb')

const state = { db: null }

module.exports.connect = function (done) {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shopping'
  const dbname = uri.split('/').pop().split('?')[0] || 'shopping'

  console.log("🔍 Trying to connect to MongoDB...")

  MongoClient.connect(uri)
    .then((client) => {
      state.db = client.db(dbname)
      console.log("✅ MongoDB connected successfully to database:", dbname)
      done()
    })
    .catch((err) => {
      console.log("❌ MongoDB connection failed:", err)
      done(err)
    })
}

module.exports.get = function () {
  return state.db
}
