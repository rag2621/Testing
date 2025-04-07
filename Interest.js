let inter =require("mongoose");

let sch= new inter.Schema({Name:String,Email:String,Phone:String,PropertyId:String});

module.exports=inter.model('Interest',sch);