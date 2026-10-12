function isAdminRole(req, res, next) {
  const role = req.user.role;
  if (role === "ADMIN") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Not An Admin",
    });
  }
}

function isCustomerRole(req, res, next) {
  const role = req.user.role;
  if (role === "CUSTOMER") {
    next();
    return;
  } else {
    return res.status(403).json({
      success: false,
      message: "Invalid User",
    });
  }
}

export { isAdminRole, isCustomerRole };
