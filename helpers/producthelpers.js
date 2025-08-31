const { ObjectId } = require('mongodb');
var db = require('../config/connection')
let collection=require('../config/collections')
let objId=require('mongodb').ObjectId

module.exports = {
  addProduct: (product, callback) => {
    console.log(product);

    db.get().collection('product').insertOne(product).then((data) => {

      callback(data.insertedId)
    })
  },
  getAllProducts:()=>{
    return new Promise(async(resolve,reject)=>{
      let products=await db.get().collection(collection.PRODUCT_COLLECTION).find().toArray()
      resolve(products)
    })
  },
  deleteProduct:(proId)=>{
    return new Promise((resolve,reject)=>{
      db.get().collection(collection.PRODUCT_COLLECTION).deleteOne({_id:new objId(proId)}).then((response)=>{
        resolve(response)

      })

    })
  },
  getProductDetails:(proId)=>{
    return new Promise((resolve,reject)=>{
       db.get().collection(collection.PRODUCT_COLLECTION).findOne({_id: new objId(proId)}).then((product)=>{
        resolve(product)
       })
    })
  },
  updateProducts: (proId, proDetails) => {
  return new Promise((resolve, reject) => {
    db.get()
      .collection(collection.PRODUCT_COLLECTION)
      .updateOne(
        { _id: new objId(proId) },
        {
          $set: {
            Name: proDetails.Name,
            Description: proDetails.Description,
            Price: proDetails.Price,
            Category: proDetails.Category
          }
        }
      )
      .then((response) => {
        resolve(response)
      })
  })


},// productHelpers.js
getProductsBySearch: (query) => {
  return new Promise(async (resolve, reject) => {
    try {
      let products = await db.get()
        .collection(collection.PRODUCT_COLLECTION)
        .find({
          Name: { $regex: query, $options: "i" }   // 👈 case-insensitive search
        })
        .toArray();
      resolve(products);
    } catch (err) {
      reject(err);
    }
  });
},

} 

