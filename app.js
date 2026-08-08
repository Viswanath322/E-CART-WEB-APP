require('dotenv').config()
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
var exphbs = require('express-handlebars');
var fileupload = require('express-fileupload')
var db = require('./config/connection');
const session = require('express-session')

var app = express();

const hbs = exphbs.create({
  extname: 'hbs',
  defaultLayout: 'layout',
  layoutsDir: path.join(__dirname, 'views/layout'),
  partialsDir: path.join(__dirname, 'views/partials'),
  // Fix: allow prototype property access (needed for MongoDB documents)
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true
  },
  helpers: {
    // Math
    multiply:       (a, b) => Number(a) * Number(b),
    inc:            (v) => parseInt(v) + 1,
    dec:            (v) => parseInt(v) - 1,
    // Comparison
    eq:             (a, b) => a == b,
    gt:             (a, b) => a > b,
    lt:             (a, b) => a < b,
    // String
    toLowerCase:    (s) => (s || '').toLowerCase().replace(/\s+/g, '-'),
    formatCurrency: (v) => `₹${v}`,
    // Date
    formatDate:     (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '',
    // Array range for pagination
    range: (start, end) => {
      const arr = [];
      for (let i = start; i <= end; i++) arr.push(i);
      return arr;
    },
    // JSON serialization for use in scripts
    json: (obj) => JSON.stringify(obj || {})
  }
});

// view engine setup
app.engine('hbs', hbs.engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vcart_fallback_secret',
  resave: true,
  saveUninitialized: true,
  cookie: { maxAge: 3600000 }
}))

// Pass user & admin session to all hbs templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.admin = req.session.admin;
  next();
});

app.use(fileupload())

// DB connection
db.connect((err) => {
  if (err) {
    console.log('❌ Database connection error: ' + err)
  } else {
    console.log('✅ Database ready (from app.js)')
  }
})

app.use('/', userRouter);
app.use('/admin', adminRouter);

// catch 404 — redirect to home instead of showing error page
app.use(function (req, res, next) {
  // If it's an API request, return JSON
  if (req.path.startsWith('/api/') || req.xhr) {
    return res.status(404).json({ error: 'Not found' });
  }
  // For page requests, redirect to home
  res.redirect('/');
});

// error handler
app.use(function (err, req, res, next) {
  console.error('❌ App error:', err.message);
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  // If it's a render error, just redirect
  if (err.status === 404) {
    return res.redirect('/');
  }
  try {
    res.render('error');
  } catch (renderErr) {
    res.send('<h1>Something went wrong</h1><p>' + err.message + '</p><a href="/">Go Home</a>');
  }
});

module.exports = app;

