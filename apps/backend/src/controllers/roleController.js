const getRoles = (req, res) => {
    // As per PRD, user roles are 'Admin', 'Manager', 'Staff'
    // These are the roles that can be assigned within a company.
    const roles = ['Admin', 'Manager', 'Staff'];
    res.json(roles);
};

module.exports = {
    getRoles,
}; 