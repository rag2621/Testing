let inter =require("mongoose");

let sch= new inter.Schema({Name:String,Email:String,Pass:String,Country:String,City:String,KYC:String});

module.exports=inter.model('Broker',sch);