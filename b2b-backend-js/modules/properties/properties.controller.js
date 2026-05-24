import prisma from '../../utils/db.js';
import { z } from 'zod';

// Zod Validation Schema
const propertySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  propertyType: z.enum(['SHOP', 'PLOT', 'WAREHOUSE']),
  listingType: z.enum(['RENT', 'SALE']),
  price: z.coerce.number().min(1, "Price must be greater than 0"),
  deposit: z.coerce.number().optional().default(0), // Coerce string to number
  areaSqFt: z.coerce.number().min(10, "Area must be valid"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
});

export const addProperty = async (req, res) => {
  try {
    const validatedData = propertySchema.parse(req.body);

    const imageUrls = req.files 
      ? req.files.map(file => `/uploads/${file.filename}`) 
      : [];

    if (imageUrls.length === 0) {
      return res.status(400).json({ error: "At least one property image is required." });
    }

    const newProperty = await prisma.property.create({
      data: {
        ownerId: req.user.userId, // From auth middleware
        title: validatedData.title,
        description: validatedData.description,
        propertyType: validatedData.propertyType,
        listingType: validatedData.listingType,
        price: validatedData.price,
        deposit: validatedData.listingType === 'RENT' ? validatedData.deposit : null,
        areaSqFt: validatedData.areaSqFt,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        images: imageUrls, // Store the array of image paths
      }
    });

    res.status(201).json({
      status: 'success',
      message: 'Property listed successfully!',
      data: newProperty
    });

  } catch (error) {
    console.error("Add Property Error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to list property' });
  }
};

export const getAllProperties = async (req, res) => {
  try {
    const currUserId=req.user.userId;
    const { type, listing, city } = req.query;

    
    const filter = {ownerId:{not:currUserId}};
    if (type) filter.propertyType = type.toUpperCase();
    if (listing) filter.listingType = listing.toUpperCase();
    if (city) filter.city = { contains: city, mode: 'insensitive' }; // Case-insensitive search

    
    const properties = await prisma.property.findMany({
      where: filter,
      include: {
        // Only select safe owner details (Never send passwords!)
        owner: {
          select: { name: true, phone: true, businessName: true, profilePic: true }
        }
      },
      orderBy: { createdAt: 'desc' } // Newest first
    });

    res.status(200).json({
      status: 'success',
      results: properties.length,
      data: properties
    });

  } catch (error) {
    console.error("Get Properties Error:", error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
};

export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    const currUserId=req.user.id;
    const property = await prisma.property.findUnique({
      where: { id },
      where:{ownerId:{not:currUserId}},
      include: {
        owner: {
          select: { name: true, phone: true, businessName: true, profilePic: true }
        }
      }
    });

    if (!property) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    res.status(200).json({
      status: 'success',
      data: property
    });

  } catch (error) {
    console.error("Get Property Error:", error);
    res.status(500).json({ error: 'Failed to fetch property details.' });
  }
};

export const toggleFavoriteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId; // From auth middleware

    // 1. Check if the property exists
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    // 2. Check if the user has already favorited it
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { favoriteProperties: { select: { id: true } } }
    });

    const isFavorited = user.favoriteProperties.some(fav => fav.id === id);

    if (isFavorited) {
      // 3a. UN-FAVORITE: Remove it from their list
      await prisma.user.update({
        where: { id: userId },
        data: {
          favoriteProperties: { disconnect: { id: id } }
        }
      });
      return res.status(200).json({ status: 'success', message: 'Removed from favorites.' });
    } else {
      // 3b. FAVORITE: Add it to their list
      await prisma.user.update({
        where: { id: userId },
        data: {
          favoriteProperties: { connect: { id: id } }
        }
      });
      return res.status(200).json({ status: 'success', message: 'Added to favorites.' });
    }

  } catch (error) {
    console.error("Toggle Favorite Error:", error);
    res.status(500).json({ error: 'Failed to update favorites.' });
  }
};