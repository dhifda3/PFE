import axios from "axios";

// Same-origin proxy in the browser → cookies stay first-party
// (works in Firefox, Safari, Chrome 3rd-party-cookie blocker, etc.).
// On the server (SSR), call the backend directly.
const api = axios.create({
  baseURL: typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000")
    : "",
  withCredentials: true,
});

// Rewrite /api/* → /api/proxy/* in the browser so requests stay same-origin
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && config.url?.startsWith("/api/") && !config.url.startsWith("/api/proxy/")) {
    config.url = config.url.replace(/^\/api\//, "/api/proxy/");
  }
  return config;
});


// Products
export const productsApi = {
  getAll: (params?: any) => api.get("/api/products", { params }),
  getById: (id: string) => api.get(`/api/products/${id}`),
  getVariants: (productId: string) => api.get(`/api/products/${productId}/variants`),
};

// Categories
export const categoriesApi = {
  getAll: () => api.get("/api/categories"),
  getById: (id: string) => api.get(`/api/categories/${id}`),
  getTree: () => api.get("/api/categories/tree"),
};

// Cart
export const cartApi = {
  get: () => api.get("/api/cart"),
  add: (productId: string, quantity: number, variantId?: string) =>
    api.post("/api/cart", { productId, quantity, variantId }),
  remove: (variantId: string) => api.delete(`/api/cart/${variantId}`),
  clear: () => api.delete("/api/cart/clear"),
};

// Orders
export const ordersApi = {
  checkout: (data: any) => api.post("/api/orders/checkout", data),
  getAll: () => api.get("/api/orders"),
  getById: (id: string) => api.get(`/api/orders/${id}`),
};

// Wishlist
export const wishlistApi = {
  get: () => api.get("/api/wishlist"),
  add: (productId: string) => api.post("/api/wishlist/items", { productId }),
  remove: (productId: string) => api.delete(`/api/wishlist/items/${productId}`),
};

// Reviews
export const reviewsApi = {
  getByProduct: (productId: string) => api.get(`/api/reviews/product/${productId}`),
  add: (data: { productId: string; rating: number; comment?: string }) =>
    api.post("/api/reviews", data),
  delete: (id: string) => api.delete(`/api/reviews/${id}`),
};

// Users — profile management
export const usersApi = {
  me: () => api.get("/api/v1/users/me"),
  updateMe: (data: {
    name?: string;
    skinType?: string | null;
    hairType?: string | null;
    skinConcerns?: string | null;
    discoverySource?: string | null;
  }) => api.put("/api/v1/users/me", data),
};

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/auth/sign-in/email", { email, password }),
  register: (data: { name: string; email: string; password: string }) =>
    api.post("/api/auth/sign-up/email", data),
  logout: () => api.post("/api/auth/sign-out"),
  me: () => api.get("/api/v1/users/me"),
};

// Recommendations
export const recommendationsApi = {
  get: (limit?: number) => api.get("/api/v1/recommendations", { params: { limit } }),
};

// Signals
export const signalsApi = {
  track: (data: { type: string; productId?: string; searchQuery?: string }) =>
    api.post("/api/v1/signals", data),
};

export default api;

