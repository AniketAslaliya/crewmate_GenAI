import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../Axios/axios";
// navigation helper removed; using window.location for redirects


const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setToken: (newToken) => {
        set({ token: newToken });
        if (newToken) {
          get().fetchUser(newToken);
        } else {
          set({ user: null });
        }
      },

      setUser: (newUser) => set({ user: newUser }),

      fetchUser: async (token) => {
        try {
          const res = await api.get("/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          // backend returns { user: { ... } }
          set({ user: res.data.user || res.data });
        } catch {
          set({ user: null });
        }
      },

      logout: () => {
        set({ token: null, user: null });
        sessionStorage.removeItem("auth-storage");
        window.location.href = '/login';
      },
    }),
    {
      name: "auth-storage",
      getStorage: () => sessionStorage,
    }
  )
);

export default useAuthStore;
