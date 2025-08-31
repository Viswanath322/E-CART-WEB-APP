const db = require('./config/connection')
const collection = require('./config/collections')
const bcrypt = require('bcrypt')

const email = "admin@gmail.com"   // your chosen admin email
const password = "a123"         // your chosen admin password

db.connect(async (err) => {
  if (err) {
    console.error("❌ DB Connection failed:", err)
    process.exit(1)
  }

  try {
    const existing = await db.get().collection(collection.ADMIN_COLLECTION).findOne({ Email: email })
    if (existing) {
      console.log("⚠️ Admin already exists with this email:", email)
      process.exit()
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.get().collection(collection.ADMIN_COLLECTION).insertOne({
      Email: email,
      Password: hashedPassword
    })

    console.log("✅ Admin created successfully!")
    console.log("Login with -> Email:", email, "Password:", password)
    process.exit()
  } catch (err) {
    console.error("❌ Error inserting admin:", err)
    process.exit(1)
  }
})
