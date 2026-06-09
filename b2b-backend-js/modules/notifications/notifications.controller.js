import prisma from '../../utils/db.js'
export const getUserNotifications=async(req,res)=>{
    try{
        const userId=req.user.userId
        const notifications=await prisma.notification.findMany({
            where:{userId},
            orderBy:{createdAt:'desc'},
            take:20
        })
        res.status(200).json({
            status:'success',
            results:notifications.length,
            data:notifications
        })
    }
    catch(err){
        console.error("fetch notification error",err)
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }

}

export const markNotificationAsRead=async(req,res)=>{
    try{
        const userId=req.user.userId;
        const {id}=req.body;
        if(id){
            await prisma.notification.updateMany({
                where:{id,userId},
                data:{isRead:true}
            })
        }
        else{
            await prisma.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true }
            });
        }
        res.status(201).json({status:'success',message:'Notifications updated'})
    }
    catch(err){
        console.error("Mark Read Error:", error);
        res.status(500).json({ error: 'Failed to update notification status' });
    }
}