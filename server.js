const express = require("express");
const cors = require('cors');
const path = require('path');
const tournamentRoutes = require("./routes/tournamentRoutes");
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/tournaments", tournamentRoutes);
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
