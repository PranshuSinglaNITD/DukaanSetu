import express from 'express';

const router = express.Router();

router.get('/test', (req, res) => {
  res.json({ message: 'notifications route works!' });
});

export default router;