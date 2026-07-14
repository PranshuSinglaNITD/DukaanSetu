import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../../utils/db.js';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export const processVoice = async (req, res) => {
    try {
        const userId = req.user.userId; 

        // 1. Check if Multer successfully caught the audio file
        if (!req.file) {
            return res.status(400).json({ error: "No voice audio provided." });
        }
        const audioPath = req.file.path;
        // 2. Read the audio file into base64 format so Gemini can "hear" it
        const audioBytes = fs.readFileSync(audioPath);
        const audioPart = {
            inlineData: {
                data: audioBytes.toString("base64"),
                mimeType: req.file.mimetype || "audio/m4a", // Matches the Expo frontend
            },
        };

        // 3. Update the prompt to tell Gemini to listen to the audio
        const prompt = `
        You are an intelligent accounting assistant for an Indian shopkeeper app named DukaanSetu.
        Listen to the attached Hinglish audio recording and extract the transaction details.
        
        You must categorize the transaction into one of three types:
        1. "SALE" (Selling goods to a customer, either paid or udhaar/credit)
        2. "EXPENSE" (Paying rent, electricity, labor, etc.)
        3. "PAYMENT" (Receiving money for a past udhaar, or paying off a supplier)

        RULES:
        - If it's a sale on credit/udhaar, set paymentStatus to "UNPAID" and amountPaid to 0.
        - If it's a cash sale, set paymentStatus to "PAID" and amountPaid to the totalAmount.
        - If no quantity is mentioned, default to 1.
        - If no unit is mentioned, default to "KG" or "Piece".
        
        Respond STRICTLY with a valid JSON object matching this exact structure:
        {
          "transactionType": "SALE" | "EXPENSE" | "PAYMENT",
          "partyName": "Name of person or expense category",
          "itemName": "Name of item (if sale)",
          "quantity": Number,
          "totalAmount": Number,
          "paymentStatus": "PAID" | "UNPAID" | "PARTIAL",
          "amountPaid": Number
        }
        `;

        // 4. Send the prompt AND the audio file directly to Gemini
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }, audioPart] }],
            generationConfig: { responseMimeType: 'application/json' }
        });

        // 5. Clean up: Delete the physical audio file from your laptop/server so it doesn't waste space
        fs.unlinkSync(audioPath);

        const aiResponse = result.response.text();
        const data = JSON.parse(aiResponse);

        let dbRecord;

        // --- DATABASE LOGIC ---
        if (data.transactionType === 'SALE') {
            const inventoryItem = await prisma.inventory.findFirst({
                where: { userId: userId, name: { contains: data.itemName, mode: 'insensitive' } }
            });

            if (!inventoryItem) {
                return res.status(404).json({ error: `Could not find '${data.itemName}' in your inventory to sell.` });
            }

            const amountDue = data.totalAmount - data.amountPaid;

            dbRecord = await prisma.sale.create({
                data: {
                    inventoryId: inventoryItem.id,
                    quantity: data.quantity,
                    sellPrice: data.totalAmount / data.quantity,
                    buyerName: data.partyName,
                    paymentStatus: data.paymentStatus,
                    amountPaid: data.amountPaid,
                    amountDue: amountDue < 0 ? 0 : amountDue,
                }
            });
        } 
        
        else if (data.transactionType === 'EXPENSE') {
            dbRecord = await prisma.expense.create({
                data: {
                    userId: userId,
                    category: data.partyName, 
                    amount: data.totalAmount,
                    date: new Date()
                }
            });
        } 
        
        else if (data.transactionType === 'PAYMENT') {
            const pendingSale = await prisma.sale.findFirst({
                where: { inventory: { userId: userId }, buyerName: data.partyName, amountDue: { gt: 0 } },
                orderBy: { soldAt: 'asc' }
            });

            if (!pendingSale) {
                return res.status(404).json({ error: `No pending Udhaar found for ${data.partyName}.` });
            }

            dbRecord = await prisma.payment.create({
                data: {
                    saleId: pendingSale.id,
                    amount: data.totalAmount,
                    method: 'CASH'
                }
            });

            await prisma.sale.update({
                where: { id: pendingSale.id },
                data: {
                    amountPaid: pendingSale.amountPaid + data.totalAmount,
                    amountDue: pendingSale.amountDue - data.totalAmount,
                    paymentStatus: (pendingSale.amountDue - data.totalAmount) <= 0 ? 'PAID' : 'PARTIAL'
                }
            });
        }

        res.status(200).json({ 
            status: 'success', 
            message: `Voice command processed successfully!`,
            extractedData: data 
        });

    } catch (error) {
        console.error("MandiBrain Error:", error);
        
        // Safety net: If the app crashes, ensure the file is still deleted so storage doesn't fill up
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ error: "Mandibrain sleeping or encountered an error." });
    }
};