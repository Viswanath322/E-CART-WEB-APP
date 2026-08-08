# V-Cart 🛒

V-Cart is a fully functional, premium e-commerce web application built using **Node.js, Express, MongoDB, and Handlebars**. It features a modern, responsive user interface with glassmorphism design elements and a complete admin dashboard for store management.

## 🌟 Features

### 🛍️ User Experience
- **Premium UI/UX:** Responsive, dark-themed design with smooth micro-animations.
- **Authentication:** Secure user signup and login using bcrypt password hashing.
- **Product Catalog:** Browse products with category filtering and smart search.
- **Shopping Cart:** Add, remove, and update quantities instantly.
- **Wishlist:** Save favorite products for later.
- **Checkout:** Multi-step checkout process with seamless validation.
- **Payment Gateway Integration:** Supports both **Cash on Delivery (COD)** and Online Payments via **Razorpay**.
- **Order History:** View past orders and their payment/delivery status.
- **User Profile:** Manage account details and track order totals.

### ⚙️ Admin Dashboard
- **Analytics & KPIs:** View total users, orders, revenue, and product count.
- **Product Management:** Full CRUD operations (Create, Read, Update, Delete) for products with image uploads.
- **Order Management:** View all user orders, update delivery status (Placed, Shipped, Delivered), and manage payments.
- **User Management:** View all registered customers.

## 🛠️ Technology Stack
- **Frontend:** HTML5, Vanilla CSS (Custom Design System), JavaScript, Handlebars (HBS)
- **Backend:** Node.js, Express.js
- **Database:** MongoDB (via native MongoDB Node.js driver)
- **Authentication:** express-session, bcrypt
- **Payments:** Razorpay API
- **File Uploads:** express-fileupload / multer

## 🚀 Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/try/download/community)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Viswanath322/E-CART-WEB-APP.git
   cd E-CART-WEB-APP
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory and add the following keys:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGO_URI=mongodb://127.0.0.1:27017/shopping
   SESSION_SECRET=your_secret_key_here
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open in browser:**
   Navigate to `http://localhost:3000`

### Admin Login
You can seed an initial admin user or register one directly into the database. By default, access the admin panel via:
`http://localhost:3000/admin`

## 🛡️ Security & Best Practices
- Environment variables hide sensitive keys.
- `nodemon.json` configured to ignore public directory uploads, preventing development session drops.
- Secure session cookie management to protect admin and user states.
- Handled edge cases for empty cart checkouts and race conditions during payment verification.

## 📄 License
This project is open-source and available under the MIT License.
