import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

// Force load the .env file 
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});