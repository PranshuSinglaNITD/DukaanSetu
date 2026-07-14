import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/db.js'; 

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_b2b_key_123';

export const register = async (req, res) => {
  try {
    const { phone, password, name, role,city } = req.body;

    if (!phone || !password || !name||!city) {
      return res.status(400).json({ error: 'Phone, password, city and name are required.' });
    }

    // 1. Check PostgreSQL if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone: phone }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this phone number already exists.' });
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Save the new user to PostgreSQL
    const newUser = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        role,city
      }
    });

    // 4. Generate Token
    const token = jwt.sign(
      { userId: newUser.id, role: newUser.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      message: 'Account created successfully!',
      token,
      user: { id: newUser.id, name: newUser.name, phone: newUser.phone, role: newUser.role,city:newUser.city }
    });

  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required.' });
    }

    // 1. Find the user in PostgreSQL
    const user = await prisma.user.findUnique({
      where: { phone: phone }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    // 2. Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid phone number or password.' });
    }

    // 3. Generate Token
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(200).json({
      status: 'success',
      message: 'Logged in successfully!',
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Server error during login.' });
  }
};