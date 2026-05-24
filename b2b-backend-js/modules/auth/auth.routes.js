import express from 'express';
import { register, login } from './auth.controller.js';

const router = express.Router();

// Step 1: First-time users create an account
router.post('/register', register);

// Step 2: Returning users log in
router.post('/login', login);

export default router;