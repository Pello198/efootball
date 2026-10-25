const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; 
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: "Access token missing. Please log in." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid or expired token." });
        req.user = user;
        next();
    });
};
const verifyAdmin = (req, res, next) => verifyToken(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Admin privileges required." });
    next();
});
module.exports = { verifyToken, verifyAdmin, JWT_SECRET };