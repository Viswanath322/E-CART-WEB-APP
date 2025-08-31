var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var userRouter = require('./routes/user');
var adminRouter = require('./routes/admin');
var exphbs = require('express-handlebars');   // ✅ use exphbs instead of hbs
var fileupload = require('express-fileupload')
var db = require('./config/connection');
const session = require('express-session')

var app = express();

// ✅ Create handlebars instance with helpers
const hbs = exphbs.create({
  extname: 'hbs',
  defaultLayout: 'layout',
  layoutsDir: path.join(__dirname, 'views/layout'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    multiply: (a, b) => a * b,              // subtotal
    inc: (value) => parseInt(value) + 1,    // index + 1
    formatCurrency: (val) => `₹${val}`      // optional currency format
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
app.use(session({ secret: 'key', cookie: { maxAge: 600000 } }))

// ✅ Pass user session to all hbs templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.use(fileupload())

// ✅ DB connection
db.connect((err) => {
  if (err) {
    console.log('❌ Database connection error: ' + err)
  } else {
    console.log('✅ Database ready (from app.js)')
  }
})

app.use('/', userRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
