import { createContext, useContext, useState, useEffect } from "react";
import API from "../api"; // 이미 만든 axios 인스턴스

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // 로그인 정보 저장
  const [loading, setLoading] = useState(true);

  // 로그인 유지 확인
  useEffect(() => {
    API.get("/me")
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await API.post("/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
