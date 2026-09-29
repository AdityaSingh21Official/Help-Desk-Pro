function validateRefreshToken(req, res, next) {
  try {
    const refreshCookie = req.cookies.refreshToken;

    if (!refreshCookie) throw new Error("BAD COOKIE");
    if (typeof refreshCookie !== "string") throw new Error("BAD COOKIE");
    const refreshRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    if (!refreshRegex.test(refreshCookie)) throw new Error("BAD COOKIE");

    req.body = { refreshToken: refreshCookie };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "INVALID VALIDATION",
    });
  }
}

export { validateRefreshToken };
