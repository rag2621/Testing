let mon =require("mongoose");

let sch= new mon.Schema({Username:String,Email:String,Pass:String,KYC:String});

module.exports=mon.model('user',sch);