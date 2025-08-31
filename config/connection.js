const { MongoClient } = require('mongodb')

const state = { db: null }

module.exports.connect = function (done) {
  const url = 'mongodb://localhost:27017'
  const dbname = 'shopping'

  console.log("🔍 Trying to connect to MongoDB...")

  MongoClient.connect(url)
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
