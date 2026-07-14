/**
 * Middleware to restrict route access to specific user roles.
 * Must be used AFTER the `protect` (authentication) middleware.
 * * @param  {...string} allowedRoles - 'FARMER', 'RETAILER', 'WHOLESALER', 'ADMIN'
 */
export const restrictTo = (...allowedRoles) => {
  return (req, res, next) => {
    // req.user is populated by your previous 'protect' auth middleware
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: "Unauthorized. Role not found." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Forbidden. Your role (${req.user.role}) does not have permission to perform this action.` 
      });
    }

    next(); // They have the right role, allow them through!
  };
};