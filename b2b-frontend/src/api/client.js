import axios from 'axios';

const BASE_URL = 'http://192.168.1.8:3000/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
});

export default apiClient;