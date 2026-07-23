export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.body) { req.body = parsed.body; }
    if (parsed.query) { req.query = parsed.query; }
    if (parsed.params) { req.params = parsed.params; }

    next();
  } catch (error) {
    return res.status(400).json({
      status: 'fail',
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }
};