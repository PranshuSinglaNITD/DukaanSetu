import axios from 'axios';

/**
 * @param {string} location - The city or district name from the database (e.g., "Ludhiana")
 */
export const getLiveWeather = async (location) => {
  if (!location) return null;

  try {
    const API_KEY = process.env.WEATHER_API_KEY; 
    // Using WeatherAPI.com format
    const url = `http://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${location}&days=3&aqi=no&alerts=yes`;
    
    const response = await axios.get(url);
    
    // Extract only the metrics that matter to crop storage
    const data = response.data;
    return {
      location: data.location.name,
      region: data.location.region,
      current: {
        temp_c: data.current.temp_c,
        humidity: data.current.humidity,
        condition: data.current.condition.text,
        precip_mm: data.current.precip_mm
      },
      forecast: data.forecast.forecastday.map(day => ({
        date: day.date,
        max_temp: day.day.maxtemp_c,
        min_temp: day.day.mintemp_c,
        chance_of_rain: day.day.daily_chance_of_rain,
        avg_humidity: day.day.avghumidity,
        condition: day.day.condition.text
      })),
      alerts: data.alerts?.alert || []
    };
  } catch (error) {
    console.error(`Weather API Error for location [${location}]:`, error.message);
    return null; // Return null gracefully so the rest of the app doesn't crash
  }
};