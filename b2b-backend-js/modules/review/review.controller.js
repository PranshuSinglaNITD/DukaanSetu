import prisma from '../../utils/db.js'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
export const submitReview=async(req,res)=>{
    try{
        const reviewerId=req.user.userId;
        const {revieweeId,rating,feedback}=req.body;
        if(!revieweeId||!rating||rating<1||rating>5){
            return res.status(400).json({error:"valid person to be reviewed or ratings bw 1 to 5 is imp"});
    
        }
        if(revieweeId==reviewerId){
            return res.status(400).json({message:"cannot review yourself"});
        }
        //we would check if shipment has occured from them
        const hasShipped=await prisma.shipment.findFirst({
            where:{
                OR:[
                    {buyerId:reviewerId, sellerId:revieweeId},
                    {buyerId:revieweeId,sellerId:reviewerId}
                ]
            }
        })
        if(!hasShipped){
            return res.status(400).json({message:"no shipment occured bw both"});
        }
        const review=await prisma.review.upsert({
            where:{
                reviewerId_revieweeId:{reviewerId,revieweeId}
            },
            update:{
                rating:parseInt(rating),
                feedback:feedback||null
            },
            create: {
                reviewerId,
                revieweeId,
                rating: parseInt(rating),
                feedback: feedback || null
            }
        })
        //rating published would be avergae of all ratings
        const aggregations = await prisma.review.aggregate({
            where: { revieweeId },
            _avg: { rating: true },
            _count: { rating: true }
        });
        const newAverage = aggregations._avg.rating || 0;
        const newTotal = aggregations._count.rating || 0;
        await prisma.user.update({
            where: { id: revieweeId },
            data: { 
              averageRating: parseFloat(newAverage.toFixed(1)), 
              totalReviews: newTotal 
            }
        });

        res.status(200).json({ 
            status: "success", 
            message: "Review submitted successfully!", 
            data: review 
        });
    }
    catch(error){
        console.error("Submit Review Error:", error);
        res.status(500).json({ error: "Failed to submit review." });
    }
}

export const getUserReviews=async(req,res)=>{
    try{
        const {targetUserId}=req.params;
        const reviews = await prisma.review.findMany({
      where: { revieweeId: targetUserId },
      include: {
        reviewer: { select: { name: true, businessName: true, profilePic: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const userStats = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { averageRating: true, totalReviews: true }
    });

    res.status(200).json({ 
      status: "success", 
      stats: userStats,
      data: reviews 
    });
    }
    catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews." });
  }
}

export const getMyReviews = async (req, res) => {
  try {
    const { userId } = req.params; 

    const reviews = await prisma.review.findMany({
      where: { revieweeId: userId }, // Now this is a valid String, not undefined!
      include: {
        reviewer: { select: { name: true, businessName: true, role: true } },
        reviewee: { select: { name: true, businessName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ status: "success", data: reviews });
  } catch (error) {
    console.error("🔥 GET MY REVIEWS CRASHED:", error);
    res.status(500).json({ error: "Failed to fetch your reviews." });
  }
};
// export const getMyReviews = async (req, res) => {
//   try {
//     const targetUserId = req.params;
//     // console.log(targetUserId);
//     const reviews = await prisma.review.findMany({
//       where: { revieweeId: targetUserId },
//       include: {
//         reviewer: { select: { name: true, businessName: true, role: true } }
//       },
//       orderBy: { createdAt: 'desc' }
//     });

//     res.status(200).json({ status: "success", data: reviews });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: "Failed to fetch your reviews." });
//   }
// };
// export const replyToReview=async(req,res)=>{
//     try{
//         const userId=req.params;
//         const {reviewId}=req.params;
//         const {replyText}=req.body;
//         if (!replyText || replyText.trim() === "") {
//             return res.status(400).json({ error: "Reply text cannot be empty." });
//         }
//         const review = await prisma.review.findUnique({ where: { id: reviewId } });
//         if (!review) return res.status(404).json({ error: "Review not found." });
//         if (review.revieweeId !== userId) return res.status(403).json({ error: "Unauthorized." });

//         const updatedReview = await prisma.review.update({
//           where: {id: reviewId},
//           data: {reply: replyText.trim()}
//         });

//         res.status(200).json({status: "success", message: "Reply posted successfully.", data: updatedReview});
//     }
//     catch(error){
//         return res.status(500).json({error:"failed to post"});
//     }
// }

export const replyToReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        
        const { replyText, userId } = req.body; 

        if (!replyText || replyText.trim() === "") {
            return res.status(400).json({ error: "Reply text cannot be empty." });
        }
        
        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }

        const review = await prisma.review.findUnique({ where: { id: reviewId } });
        if (!review) return res.status(404).json({ error: "Review not found." });
        
        if (review.revieweeId !== userId) {
            return res.status(403).json({ error: "Unauthorized. You can only reply to your own reviews." });
        }

        const updatedReview = await prisma.review.update({
          where: { id: reviewId },
          data: { reply: replyText.trim() }
        });

        res.status(200).json({ status: "success", message: "Reply posted successfully.", data: updatedReview });
    }
    catch (error) {
        console.error("Reply Error:", error);
        return res.status(500).json({ error: "failed to post" });
    }
}

//dentiment analysis
export const generateReviewSentiment = async (req, res) => {
  try {
    const {userId} = req.params;
    const reviews = await prisma.review.findMany({
      where: { revieweeId: userId, feedback: { not: null } },
      select: { rating: true, feedback: true }
    });

    if (reviews.length === 0) {
      return res.status(400).json({ error: "Not enough written feedback to generate an analysis." });
    }
    const reviewTexts = reviews.map((r, i) => `[Rating: ${r.rating}/5] - "${r.feedback}"`).join("\n");

    const systemPrompt = `You are an expert business analyst for an agricultural B2B platform. 
    Analyze the following customer reviews for this seller.
    
    Provide a concise, 3-bullet-point summary focusing on:
    1. Overall Sentiment (Positive/Negative/Neutral) and the primary feeling of buyers.
    2. Key Strengths (What the seller does best).
    3. Areas for Improvement (What the seller needs to fix).
    
    Keep it strictly professional and brief. Do not use markdown headers, just bullet points.
    Also do not answer anything outside analysis of review if user asks anything else then answer them you cannot tell them anything bryond sentiment analysis
    
    Reviews:
    ${reviewTexts}`;
    const llm = new ChatGoogleGenerativeAI({
      modelName: "gemini-2.5-flash",
      apiKey: process.env.GEMINI_API_KEY,
      temperature: 0.2, //Low temp for analytical consistency
    });

    const response = await llm.invoke(systemPrompt);

    res.status(200).json({ 
      status: "success", 
      sentimentAnalysis: response.content 
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to generate AI sentiment." });
  }
};

export const getGivenReviews = async (req, res) => {
  try {
    const { userId } = req.params; 

    const reviews = await prisma.review.findMany({
      where: { reviewerId: userId }, 
      include: {
        reviewer: { select: { name: true, businessName: true, role: true } },
        reviewee: { select: { name: true, businessName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ status: "success", data: reviews });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch given reviews." });
  }
};