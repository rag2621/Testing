const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const fs = require("fs");
const https = require("https");
const Schema = require("./schema");
const cors=require("cors");
const axios = require("axios");
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary.js');
const Up=require("./upload.js");
const { v4: uuidv4 } = require('uuid');
const inter=require("./Interest.js");
const brok=require("./broker.js");
const car=require("./Career.js");
const Tesseract = require("tesseract.js");

const dest = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "uploads/"); // ✅ Images "uploads/" folder me store hongi
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
    },
  });
const up = multer({ dest: "uploads/" });

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));
const generateToken = (user) => jwt.sign(
    { email: user.Email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
);
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'uploads', // Cloudinary ke andar ek folder banayega
      format: async (req, file) => 'png', // Image format define karein
      public_id: (req, file) => file.originalname.split('.')[0] // File ka naam
    }
  });
  
  const upload = multer({ storage: storage });

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    console.log(req.headers);
  
    if (!token) {
      return res.status(404).json({ message: 'Token is required' });
    }
  
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(404).json({ message: 'Invalid or expired token' });
      }
      req.user = decoded;
      next();
    });
  };


const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, "server.key")), 
    cert: fs.readFileSync(path.join(__dirname, "server.cert"))
};


const router = express.Router();
app.use("/", router);
router.get("/test", (req, res) => {
    res.json({ message: "✅ Router is working!" });
});
const GOOGLE_API_KEY = 'AIzaSyAZXp1qf2pU3pkiqavT6u-WSqFxp8ij0ec';
app.get("/api/properties/:id", async (req, res) => {
    try {
        const {id}=req.params;
        const property = await Up.findOne({PropertyId:id});
        if (!property) return res.status(404).json({ error: "Property not found" });
        res.json(property).status(200);
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});


app.use(express.json());

// KYC Verification Route
app.post("/verify-kyc", up.single("document"), async (req, res) => {
    const { name, dob, idNumber,Email } = req.body; // User-provided details (name, dob, idNumber)
  const imagePath = req.file.path; // Uploaded image file path

console.log(Email);

  try {
    // Extract text from the uploaded image
    const { data: { text } } = await Tesseract.recognize(imagePath, "eng");

    // Debugging: log the extracted text
    console.log("Extracted Text:", text);

    // Convert the extracted text to lowercase for easier matching
    const extractedText = text.toLowerCase();

    // Validate Name (Check if the name exists in extracted text)
    const isNameValid = extractedText.includes(name.toLowerCase());

    // Format and validate DOB
    const dobRegex = /\d{2}[-/]\d{2}[-/]\d{4}/; // Regex to find date format mm-dd-yyyy or mm/dd/yyyy
    const extractedDob = extractedText.match(dobRegex) ? extractedText.match(dobRegex)[0] : null;

    // If a date is found, convert it to dd/mm/yyyy format
    let formattedExtractedDob = null;
    if (extractedDob) {
      // Convert to dd/mm/yyyy format
      const dateParts = extractedDob.split(/[-/]/); // Split by either '-' or '/'
      if (dateParts.length === 3) {
        // If mm-dd-yyyy or mm/dd/yyyy, swap the parts to dd/mm/yyyy
        formattedExtractedDob = `${dateParts[1]}/${dateParts[0]}/${dateParts[2]}`;
      }
    }
    function convertDate(isoDate) {
        const parts = isoDate.split("-");
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const formattedDate = convertDate(dob);
    // Validate DOB (Check if formatted date matches the user-provided DOB)
    const isDOBValid = extractedText.includes(formattedDate );

    // Validate ID Number (Check if ID Number exists in the extracted text)

    function formatAadhaar(number) {
        return number.replace(/(\d{4})(\d{4})(\d{4})/, "$1 $2 $3");
    }
    const formattedNumber = formatAadhaar(idNumber);
    const isIDValid = extractedText.includes(formattedNumber);
console.log(isNameValid);
console.log(isDOBValid);
console.log(formattedDate );

    // If all validations pass, return success
    if (isNameValid && isDOBValid && isIDValid) {
        const result = await Schema.updateOne(
            { Email: Email },  // Filter (Find user by email)
            { $set: { KYC:"Approved" } } // Update username
        );
      return res.json({ status: "approved", message: "KYC Verified Successfully" });
     

    } else {
      return res.json({
        status: "rejected",
        message: "KYC Validation Failed. Please check your details.",
      });
    }
  } catch (error) {
    return res.status(500).json({ error: "Error processing KYC document" });
  }
});

app.get("/api/address-suggestions",verifyToken, async (req, res) => {
    const query = req.query.query;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    const googlePlacesUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&key=${GOOGLE_API_KEY}`;

    try {
        const response = await fetch(googlePlacesUrl);
        const data = await response.json();
        res.json(data); 
    } catch (error) {
        console.error('Error fetching places:', error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

app.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        
        res.json({ imageUrl: req.file.path });
        console.log(req.body.id);
        Up.updateOne({PropertyId:req.body.id}, {$push: { Images: req.file.path }}).then(()=>{
            console.log("updated");
        });
        

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        Up.updateOne({Title:"OMAXE"}, {$push: { amenities: req.file.path }}).then(()=>{
            console.log("updated");
        })
        res.json({ imageUrl: req.file.path });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/interest',async(req,res)=>{

    const {Name,Email,Phone,PropertyId}=req.body;

  const det= await inter.create({Name:Name,Email:Email,Phone:Phone,PropertyId:PropertyId});

  if(det){

    res.json({status:"OK"});
  }
    
})

router.post('/listing/propertyinfo', async (req,res)=>{

    let pinf=req.body;
    console.log(pinf);
     const id=uuidv4();
  const np=await  Up.create({Title:pinf.title,Type:pinf.propertyType,Bed:pinf.bedrooms,Bath:pinf.bathrooms, City:pinf.city,Location:pinf.location,Area:pinf.area,Description:pinf.description,PropertyId:id,Amenities:pinf.amenities,Email:pinf.Email});
       
    console.log("data sent",np);

        res.json({PId:id});
        
    });




router.get("/listing/properties", async (req, res) => {
    const { search, type } = req.query;

    const data= await Up.find({City:search,Type:type});
    res.json(data);


    


    
});

router.post("/user/signup", async (req, res) => {
    try {
        const { uname, email, password,KYC } = req.body;
        const existingUser = await Schema.findOne({ Email: email });
        if (existingUser) return res.status(400).json({ message: "Account already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await Schema.create({ Username: uname, Email: email, Pass: hashedPassword ,KYC:KYC});
        res.status(201).json({ message: "Signup successful" });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

app.post("/broker/signup",async (req,res)=>{
    try {
        const { uname, email, password,Country,City,KYC } = req.body;
        const existingUser = await brok.findOne({ Email: email });
        if (existingUser) return res.status(400).json({ message: "Account already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await brok.create({ Name:uname , Email: email, Pass: hashedPassword,Country:Country,City:City ,KYC:KYC});
        res.status(201).json({ message: "Signup successful" });
    } catch (error) {
        res.status(500).json({ error: "Server Error" });
    }
});

router.post("/user/login", async (req, res) => {
    try {

        const   usercred=req.body;
   
       const  dbfetch=await  Schema.findOne({Email:usercred.Email});
         console.log(dbfetch);
     
   
           const isMatch = await bcrypt.compare(usercred.Pass, dbfetch.Pass);
         if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
         else{
           console.log(dbfetch.Username);
          const t=generateToken(dbfetch);
           console.log(t);
           res.status(201).json({ message: 'successful',Token:t, Username:dbfetch.Username,Email:dbfetch.Email, Kyc:dbfetch.KYC });
   
         }
     
       } catch (error) {
           res.status(400).json({ message: "Email does not exist" });
       }
   
   
});

router.post("/broker/login", async (req, res) => {
  try {

      const   usercred=req.body;
 
     const  dbfetch=await  brok.findOne({Email:usercred.Email});
       console.log(dbfetch);
   
 
         const isMatch = await bcrypt.compare(usercred.Pass, dbfetch.Pass);
       if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
       else{
         console.log(dbfetch.Name);
        const t=generateToken(dbfetch);
         console.log(t);
         res.status(201).json({ message: 'successful',Token:t, Username:dbfetch.Name,Email:dbfetch.Email, Kyc:dbfetch.KYC,City:dbfetch.City });
 
       }
   
     } catch (error) {
         res.status(400).json({ message: "Email does not exist" });
     }
 
 
});






router.get('/photo/up',(req,res)=>{
    res.sendFile(path.join(__dirname,'photo.html'));
   
});

app.get('/auth/kyc',(req,res)=>{
    res.sendFile(path.join(__dirname,'kyc.html'));
})

app.get('/api/countrycode/:cname',async(req,res)=>{

  const {cname}=req.params;
  
  async function getCities(countryName) {
    try {
        const response = await fetch("https://countriesnow.space/api/v0.1/countries");
        const data = await response.json();
        
        // Find the country and get its cities
        const countryData = data.data.find(c => c.country === countryName);
        if (countryData) {
            return countryData.cities;
        } else {
            return ["No cities found"];
        }
    } catch (error) {
        console.error("Error fetching cities:", error);
        return ["Error fetching cities"];
    }
}

// Example Usage
getCities(cname).then(cities => res.json(cities));
  


});

app.get('/api/broker-properties/:City', async (req,res)=>{
  const {City}=req.params;

   const data= await Up.find({City:City});

   res.json(data);



});

app.get('/api/broker-properties/yourlisting/:Email', async (req,res)=>{
  const {Email}=req.params;

   const data= await Up.find({Email:Email});

   res.json(data);



});

app.get('/api/interests/:ID', async (req,res)=>{
  const {ID}=req.params;

   const data= await inter.find({PropertyId:ID});

   res.json(data);



})


  
app.post("/Careers/apply",async (req,res)=>{

  const {Name,Email,Phone,Desc}=req.body;

  let d= await car.create({Name:Name,Email:Email,Phone:Phone,Desc:Desc});

  if(d){
    res.json({status:"OK"});
  }
})


const allowedPages = [
    "landingpage",
    "listedproperty",
    "listing",
    "Login_profile",
    "signup_profile",
    "admin_signin",
    "admin_signup",
    "User_Signup",
    "User_signin",
    "listinggg",
    "brokerpage",
    "Leads",
    "yourlistings",
    "Careers"
    
];

router.get("/:page", (req, res) => {
    const { page } = req.params;
    if (allowedPages.includes(page)) {
        res.sendFile(path.join(__dirname, page, `${page}.html`));
    } else {
        res.status(404).send("Page Not Found");
    }
});





const PORT = 5500;
const MONGO_URI = "mongodb+srv://raghavdhiman2006:123@raghav.loyrcrt.mongodb.net/"

mongoose
    .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("✅ MongoDB Connected");
        https.createServer(sslOptions, app).listen(PORT, () => {
            console.log(`🚀 HTTPS Server running on port ${PORT}`);
        });
    })
    .catch(err => console.error(" MongoDB Connection Error:", err));
