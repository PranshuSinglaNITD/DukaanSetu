import prisma from '../../utils/db.js';
import { z } from 'zod';
import {Expo} from 'expo-server-sdk'

// Zod Validation Schemas
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional().or(z.literal("")),
  businessName: z.string().min(2, "Business name must be at least 2 characters").optional().or(z.literal("")),
  address: z.string().min(5, "Address must be at least 5 characters").optional().or(z.literal("")),
});

const businessTypeSchema = z.object({
  businessType: z.enum(['kirana', 'medical', 'bakery', 'electronics', 'wholesaler', 'other'], {
    errorMap: () => ({ message: "Invalid business type selected" })
  }),
});

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, phone: true, role: true, profilePic: true, businessName: true, businessType: true, address: true }
    });
    res.status(200).json({ status: 'success', data: user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    // 1. Validate incoming data
    const validatedData = profileSchema.parse(req.body);

    // 2. Clean the data (remove empty strings so Prisma doesn't overwrite real data with nothing)
    const dataToUpdate = {};
    if (validatedData.name) dataToUpdate.name = validatedData.name;
    if (validatedData.businessName) dataToUpdate.businessName = validatedData.businessName;
    if (validatedData.address) dataToUpdate.address = validatedData.address;

    // 3. Update user in the database
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: dataToUpdate,
      select: { name: true, businessName: true, address: true }
    });

    res.status(200).json({ status: 'success', message: 'Profile updated', data: updatedUser });
  } catch (error) {
    console.error("Update Profile Error:", error); // ADD THIS TO SEE EXACT ERROR IN TERMINAL
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const switchBusinessType = async (req, res) => {
  try {
    const { businessType } = businessTypeSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { businessType },
      select: { businessType: true }
    });

    res.status(200).json({ status: 'success', message: `Business type switched to ${businessType}`, data: updatedUser });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid business type', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to switch business type' });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // In a real app, this would be an AWS S3 URL. For now, it's a local path.
    const imagePath = `/uploads/${req.file.filename}`;

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { profilePic: imagePath }
    });

    res.status(200).json({ status: 'success', message: 'Profile picture uploaded', profilePic: imagePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

export const getBusinessStats = async (req, res) => {
  try {
    // Since we don't have the Orders/Inventory tables yet, we mock the analytics logic
    // Later, you will use Prisma aggregations here (e.g., prisma.order.aggregate)
    
    const mockStats = {
      totalSalesThisMonth: 45000,
      activeOrders: 12,
      topSellingProduct: 'Aashirvaad Atta 5kg',
      lowStockAlerts: 3,
      aiInsight: 'Demand for cold drinks is expected to rise by 20% next week due to incoming heatwave.'
    };

    res.status(200).json({ status: 'success', data: mockStats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch business stats' });
  }
};

//whenever the user is created along with it a token is created so that whwenever a notification is sent it could be identified via the token created during the user login
export const savePushToken=async(req,res)=>{
  try{
    const userId=req.user.userId;
    const {pushToken}=req.body
    if(!pushToken){
      res.status(400).json({error:"required push token"})
    }
    if (!Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({ error: "Provided token is not a valid Expo push token" });
    }
    //save token to user profile
    await prisma.update({
      where:{id:userId},
      data:{pushToken}
    });
    res.status(200).json({ 
      status: 'success', 
      message: 'Push token successfully registered for notifications.' 
    });
  }
  catch(error) {
    console.error("Save Push Token Error:", error);
    res.status(500).json({ error: 'Failed to store push token' });
  } 
}