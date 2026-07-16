import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';


export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Acesso negado. Token não fornecido ou inválido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const validToken = jwt.verify(token, process.env.JWT_SECRET);

    const decryptedData = {
      id: validToken.id,
      email: validToken.email,
    };

    req.user = decryptedData;

    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
};

export const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5, // Limite de requisições por IP
  message: 'Muitas tentativas de login neste IP, tente novamente após 15 minutos.',
});
