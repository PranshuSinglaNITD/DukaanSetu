export const validateData = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid request data',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          issue: err.message
        }))
      });
    }
  };
};