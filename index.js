var express = require("express");
var app = express();
app.use(express.json());
const multer = require("multer");
const { MongoClient, ObjectId } = require("mongodb");
var cors = require("cors");
const path = require("path");

app.use(cors());
const url = "mongodb+srv://igopi170:akash170@cluster0.cd5na.mongodb.net/";
const client = new MongoClient(url);
const dbName = "itineary";
const PORT = 8080;

const bcrypt = require("bcrypt");

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads"); // Save files in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
  },
});
const upload = multer({ storage });

// MongoDB connection helper function
async function connectToDatabase() {
  try {
    await client.connect();
    const db = client.db(dbName);
    return db;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

// Create User Route
app.post("/create_register", upload.single("profilePicture"), async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const profilePicture = req.file;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ msg: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name,
      email,
      password: hashedPassword,
      profilePicture: profilePicture ? `/${profilePicture.filename}` : null, // Use relative path
    };

    const db = await connectToDatabase();
    const existingUser = await db.collection("registerDetails").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    await db.collection("registerDetails").insertOne(userData);
    res.status(200).json({
      msg: "Successfully registered",
      user: {
        name: userData.name,
        email: userData.email,
        profilePicture: userData.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ msg: "Invalid email format" });
    }

    const db = await connectToDatabase();
    const user = await db.collection("registerDetails").findOne({ email });

    if (!user) {
      return res.status(404).json({ msg: "User not found. Please register first." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials. Please try again." });
    }

    res.status(200).json({
      msg: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// Create Itinerary Route
app.post("/create_itinerary", async (req, res) => {
  try {
    const { destination, date, options, userId } = req.body;

    // Validation
    if (!destination || !date || !options) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // Ensure date is an object with startDate and endDate
    if (!date.startDate || !date.endDate) {
      return res.status(400).json({ msg: "Both start and end dates are required" });
    }

    // Function to validate date format (dd/MM/yyyy)
    const isValidDateFormat = (dateString) => {
      return /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(dateString);
    };

    // Validate startDate and endDate formats
    if (!isValidDateFormat(date.startDate) || !isValidDateFormat(date.endDate)) {
      return res.status(400).json({ msg: "Invalid date format. Use dd/MM/yyyy" });
    }

    // Ensure 'options' is an array
    if (!Array.isArray(options)) {
      return res.status(400).json({ msg: "'options' must be an array" });
    }

    // Optional: Associate the itinerary with a user (if logged in)
    const itineraryData = {
      destination,
      date,
      options,
      userId, // Associate with the logged-in user
    };

    const db = await connectToDatabase();
    await db.collection("createItinerary").insertOne(itineraryData);

    // Return the created itinerary data
    res.status(200).json({ msg: "Itinerary created successfully", itinerary: itineraryData });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});

// Get Itinerary Route
app.get("/getItinerary", async (req, res) => {
  try {
    // Extract userId from query parameters (if provided)
    const { userId } = req.query;

    const db = await connectToDatabase();
    let itineraries;

    if (userId) {
      // If userId is provided, filter itineraries by userId
      itineraries = await db
        .collection("createItinerary")
        .find({ userId: new ObjectId(userId) }) // Use ObjectId for userId to match MongoDB document format
        .toArray();
    } else {
      // If no userId is provided, retrieve all itineraries
      itineraries = await db.collection("createItinerary").find().toArray();
    }

    if (itineraries.length === 0) {
      return res.status(404).json({ msg: "No itineraries found" });
    }

    // Return the found itineraries
    res.status(200).json({
      msg: "Itineraries retrieved successfully",
      itineraries,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
});


// Serve Uploaded Files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
