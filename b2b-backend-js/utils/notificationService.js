import prisma from './db.js';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

export const sendAppNotification = async (userId, title, message, type = 'INFO') => {
  try {
    // 1. Save it to the database so it appears in the app's "Bell" menu
    const notification = await prisma.notification.create({
      data: { userId, title, message, type }
    });

    // 2. Fetch the user's phone token
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // 3. If they have a valid token, buzz their phone!
    if (user && user.pushToken && Expo.isExpoPushToken(user.pushToken)) {
      const messages = [{
        to: user.pushToken,
        sound: 'default',
        title: title,
        body: message,
        data: { type: type, route: 'Notifications' }, // Tells the app what to do when tapped
      }];

      await expo.sendPushNotificationsAsync(messages);
    }

    return notification;
  } catch (error) {
    console.error("Notification Service Error:", error);
    return null;
  }
};