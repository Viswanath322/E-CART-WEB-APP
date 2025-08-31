function addToCart(proId){
    $.ajax({
        url: '/add-to-cart/' + proId,
        method: 'get',
        success: (response) => {
    if (response.status) {
        let count = $('#cart-count').html();
        count = parseInt(count) + 1;
        $('#cart-count').html(count);  // ✅ Update cart count properly
    }
}

    });
}



function changeQuantity(cartId, productId, count, userId) {
  let qtyElem = document.getElementById("qty-" + productId);
  let currentQty = parseInt(qtyElem.innerText) || 0;

  $.ajax({
    url: '/change-product-quantity',
    method: 'post',
    data: {
      cart: cartId,
      product: productId,
      count: count,
      quantity: currentQty,
      userId: userId   // 👈 send it
    },
    success: function(res) {
  if (res.blockDecrement) {
    // Prevent going below 1
    alert("Minimum quantity is 1");
    return;
  }

  if (res.removeProduct) {
    $("#product-row-" + productId).remove();
  } else {
    $("#qty-" + productId).text(res.newQuantity);
    $("#subtotal-" + productId).text("₹" + res.subtotal);
  }
  $("#grand-total").text("₹" + res.total);

  // Disable minus button if qty is 1
  if (res.newQuantity == 1) {
    $("#minus-btn-" + productId).prop("disabled", true);
  } else {
    $("#minus-btn-" + productId).prop("disabled", false);
  }
}


  });
}


$(document).ready(function () {
  $("#checkout-form").submit(function (e) {
    e.preventDefault(); // stop normal form submit

    let form = $(this);
    let formData = form.serialize();

    let paymentMethod = form.find("select[name='payment-method']").val();

    if (paymentMethod === "COD") {
      // For COD → directly place order
      $.post("/order-success", formData, function () {
        window.location.href = "/order-success";

      });
    } else {
      // For ONLINE → first create Razorpay order from backend
      $.post("/create-order", formData, function (order) {
        openRazorpay(order);
      });
    }
  });
});

function openRazorpay(order) {
  var options = {
    "key": "rzp_test_RB2cjCJ7uO9UiR",  // your test key
    "amount": order.amount,            // already in paise
    "currency": order.currency,
    "name": "My E-Commerce Store",
    "description": "Order Payment",
    "order_id": order.id,              // Razorpay order ID from backend
    "handler": function (response) {
      // verify payment at backend
      $.ajax({
        url: '/verify-payment',
        method: 'post',
        data: {
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          orderId: order.id
        },
        success: function (res) {
          if (res.status) {
            window.location.href = "/order-success";
          } else {
            alert("❌ Payment verification failed");
          }
        }
      });
    },
    "prefill": {
      "name": "Customer Name",
      "email": "customer@example.com",
      "contact": "9876543210"
    },
    "theme": {
      "color": "#3399cc"
    }
  };

  var rzp1 = new Razorpay(options);
  rzp1.open();
}


$('#search-box').on('keyup', function() {
  let query = $(this).val();
  
  $.ajax({
    url: '/api/search',
    method: 'get',
    data: { q: query },
    success: (products) => {
      let productHtml = '';

      if (products.length === 0) {
        productHtml = `<p class="text-center text-muted py-4">No products found</p>`;
      } else {
        products.forEach(p => {
          productHtml += `
            <div class="row border-bottom py-3 align-items-center product-row">
              <div class="col-md-3 text-center">
                <img src="/productimages/${p._id}.jpg" class="img-fluid product-img">
              </div>
              <div class="col-md-6">
                <h5>${p.Name}</h5>
                <p class="text-muted small">${p.Category}</p>
                <p class="text-muted small">${p.Description}</p>
                
              </div>
              <div class="col-md-3 text-end">
                <h4>₹${p.Price}</h4>
                <button class="btn btn-primary btn-sm" onclick="addToCart('${p._id}')">Add to Cart</button>
              </div>
            </div>`;
        });
      }

      $('section .container').html(productHtml);
    }
  });
});













