require ("dotenv").config();
const express = require("express");
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const tournamentRoutes = require("./routes/tournamentRoutes");
const app = express();
const upload = multer({ storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public/uploads/')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
})});
app.use(cors(), express.json(), express.static(path.join(__dirname, "public")));
app.use("/tournaments", tournamentRoutes);
const PORT= process.env.PORT;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));