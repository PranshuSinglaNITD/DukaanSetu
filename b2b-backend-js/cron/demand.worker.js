import cron from 'node-cron';
import prisma from '../utils/db.js';

export const startDemandWorkers = () => {
  // Note: For testing right now, change '0 0 * * *' to '* * * * *' (which runs every 60 seconds)
  cron.schedule('0 0 * * *', async () => {
    console.log("Waking up to clean stale market demands...");

    try {
      // Define what makes a demand "Stale" (e.g., 7 days old)
      const expirationDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 1. Batch update all dead demands directly in PostgreSQL
      const cleanupResult = await prisma.buyerDemand.updateMany({
        where: {
          status: 'ACTIVE',
          createdAt: { lt: expirationDate } // "lt" means Less Than (older than 7 days)
        },
        data: { 
          status: 'EXPIRED' 
        }
      });

      // 2. Log the outcome based on database rows affected
      if (cleanupResult.count > 0) {
        console.log(`Success: Auto-expired ${cleanupResult.count} stale demands in the database.`);
      } else {
        console.log("Market is clean. No stale demands found.");
      }

    } catch (error) {
      console.error("Failed during scheduled cleanup:", error);
    }
  });
};