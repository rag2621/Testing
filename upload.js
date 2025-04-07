let mon =require("mongoose");

let sch= new mon.Schema({Title:String,Type:String,Bed:String,Bath:String, City:String,Location:String,Images:Array,Description:String,Area:Number,PropertyId:String,Amenities:Array,Email:String});

module.exports=mon.model('Upload',sch);