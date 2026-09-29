import jwt from "jsonwebtoken";

function verifyAccessToken(req, res, next) {
  try {
    const bearerToken = req.headers.authorization;

    if (!bearerToken || bearerToken.length === 0) {
      return res.status(401).json({
        success: false,
        message: "NO AUTHENTICATION",
      });
    }

    const values = bearerToken.split(" ");

    if (values[0] !== "Bearer") {
      return res.status(401).json({
        success: false,
        message: "NO AUTHENTICATION",
      });
    }

    const token = values[1];

    const deconstruct = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    req.user = deconstruct;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Expired Token",
        expiredAt: error.expiredAt,
      });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "INVALID TOKEN",
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Authentication Failed",
      });
    }
  }
}

export { verifyAccessToken };
