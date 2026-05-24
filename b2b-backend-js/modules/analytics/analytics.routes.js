import express from 'express';

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'analytics route works!' });
});

export default router;