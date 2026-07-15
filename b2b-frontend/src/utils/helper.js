export const getTrustDesignation = (rating,totalReviews) => {
  if (totalReviews < 5) return { title: "New Seller", color: "#94a3b8", bg: "#f1f5f9" };
  
  if (rating >= 4.8) return { title: "Super Trustable", color: "#059669", bg: "#d1fae5" };
  if (rating >= 4.0) return { title: "Reliable Partner", color: "#0284c7", bg: "#e0f2fe" };
  if (rating >= 3.0) return { title: "Average Rating", color: "#d97706", bg: "#fef3c7" };
  
  return { title: "Proceed with Caution", color: "#dc2626", bg: "#fee2e2" };
};