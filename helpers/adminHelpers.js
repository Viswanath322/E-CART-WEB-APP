var db = require('../config/connection')
const collection = require('../config/collections')
const util = require('util')
const bcrypt = require('bcrypt')
const { promiseHooks } = require('v8')
const { pipeline } = require('stream')
const { log } = require('console')
const objId=require('mongodb').ObjectId


module.exports = {
  doLogin: (adminData) => {
  return new Promise(async (resolve, reject) => {
    let response = {}
    
    // Normalize keys (accept both lowercase and uppercase from form)
    const email = adminData.Email || adminData.email
    const password = adminData.Password || adminData.password

    console.log("🔍 Looking for admin:", email)

    let admin = await db.get().collection(collection.ADMIN_COLLECTION)
      .findOne({ Email: email })   // DB has Email with capital "E"

    if (admin) {
      console.log("✅ Admin found:", admin.Email)
      bcrypt.compare(password, admin.Password).then((status) => {
        if (status) {
          console.log("✅ Password matched")
          response.admin = admin
          response.status = true
          resolve(response)
        } else {
          console.log("❌ Invalid password")
          resolve({ status: false })
        }
      })
    } else {
      console.log("❌ No admin found with this email")
      resolve({ status: false })
    }
  })
}

}

