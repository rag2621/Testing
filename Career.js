let mon =require("mongoose");

let sch= new mon.Schema({Name:String,Email:String,Phone:String,Desc:String});

module.exports=mon.model('Career',sch);