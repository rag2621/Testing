let mon =require("mongoose");

let sch= new mon.Schema({ID:String});

module.exports=mon.model('kyc',sch);