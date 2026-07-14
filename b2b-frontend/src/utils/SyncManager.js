//type of abstraction
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
const QUEUE_KEY='@mandi_sync_queue'
const BACKEND_URL='http://192.168.1.8:5000'
export const SyncManager={
    addJobToQueue:async(endpoint,payload)=>{
        try{
            const existingQueueJSON=await AsyncStorage.getItem(QUEUE_KEY);
            const queue=existingQueueJSON?JSON.parse(existingQueueJSON):[];
            const newJob={
                id:Date.now().toString(),
                endpoint:endpoint,
                payload:payload,
                retryCount:0,
                createdAt:new Date().toString()
            }
            queue.push(newJob);
            await AsyncStorage.setItem(QUEUE_KEY,JSON.stringify(queue));
            console.log(`${newJob.id} created`);
        }
        catch(error){
            console.error("Failed to add job to queue", error);
        }
    },
    //now job is added if the network comes then job would be processed
    processQueue: async () => {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      console.log('Still offline. Queue processing aborted.');
      return;
    }

    try {
      const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
      if (!queueJson) return;
      
      let queue = JSON.parse(queueJson);
      if (queue.length === 0) return;

      console.log(`Starting to process ${queue.length} jobs in queue`);
      let remainingQueue = [];

      for (let job of queue) {
        try {
          let requestBody;
          let headers = {};

          // --- THE MAGIC: Check if this job has an image attached ---
          if (job.payload.isMultipart) {
            requestBody = new FormData();
            
            Object.keys(job.payload).forEach(key => {
              if (key === 'imageUri') {
                // Reconstruct the image object for React Native fetch
                requestBody.append('images', { 
                  uri: job.payload[key], 
                  name: 'offline_upload.jpg', 
                  type: 'image/jpeg' 
                });
              } else if (key !== 'isMultipart') {
                // Append all other text fields (name, price, stock, etc.)
                requestBody.append(key, job.payload[key]);
              }
            });
            
            // NOTE: When sending FormData via fetch, DO NOT manually set 'Content-Type'.
            // React Native automatically sets it to 'multipart/form-data; boundary=---...'
            headers = {}; 
          } else {
            // It's a standard text-only JSON request
            requestBody = JSON.stringify(job.payload);
            headers = { 'Content-Type': 'application/json' };
          }
          const res = await fetch(`${BACKEND_URL}${job.endpoint}`, {
            method: 'POST', // Fixed syntax
            headers: headers,
            body: requestBody
          });

          if (res.ok) {
            console.log(`Job ${job.id} synced successfully!`);
          } else {
            throw new Error('Server rejected the payload'); // Fixed syntax
          }

        } catch (error) {
          console.log(`Job ${job.id} failed to sync. Incrementing retry count. Error: ${error.message}`);
          
          job.retryCount += 1;

          if (job.retryCount < 5) {
            remainingQueue.push(job);
          } else {
            console.log(`Job ${job.id} permanently dropped after 5 attempts`);
          }
        }
      }

      // Save only the failed jobs back to AsyncStorage
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));

    } catch (error) {
      console.error('Error processing queue', error);
    }
  }
}