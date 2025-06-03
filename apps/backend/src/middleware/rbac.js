const rbac = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Access Denied: User role not available.' });
        }

        const userRole = req.user.role;

        if (allowedRoles.includes(userRole)) {
            next(); // Role is allowed, proceed to the next middleware/handler
        } else {
            res.status(403).json({ message: 'Access Denied: You do not have permission to perform this action.' });
        }
    };
};

module.exports = rbac; 