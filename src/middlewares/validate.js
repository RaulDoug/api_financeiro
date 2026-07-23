import { ZodError } from 'zod';

export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (parsed.query) {
      // Mutar/Atualizar os valores existentes no objeto req.query
      Object.keys(req.query).forEach(key => delete req.query[key]);
      Object.assign(req.query, parsed.query);
    }

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        status: 'fail',
        errors: (error.errors || error.issues).map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }
    return next(error);
  }
};