import apiClient from './client';

export const fetchProducts = async () => {
  try {
    const response = await apiClient.get('/products');
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
};
 
export const fetchProperties = async () => {
  try {
    const response = await apiClient.get('/properties');
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching properties:", error);
    return [];
  }
};