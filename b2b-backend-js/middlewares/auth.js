import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  try {
    //Get the token from the header (Looks like: "Bearer eyJhbGciOiJIUz...")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: "Access Denied. No token provided." });
    }

    //Verify the token using your secret key from your .env file
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: "Invalid or expired token." });
      }

      //Attach the decoded user data to the request
      //This makes `req.user.userId` available in all your controllers!
      req.user = decoded; 
      
      //Move on to the next function (the controller)
      next(); 
    });
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ error: "Internal server error during authentication." });
  }
};