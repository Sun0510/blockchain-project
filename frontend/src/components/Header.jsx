import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout } = useAuth();

  const handleLogin = () => {
    window.location.href = "http://localhost:4000/api/auth/google"; // 구글 로그인로 이동
  };

  return (
    <header>
      {user ? (
        <>
          <span>{user.name}님 환영합니다!</span>
          <button onClick={logout}>로그아웃</button>
        </>
      ) : (
        <button onClick={handleLogin}>로그인</button>
      )}
    </header>
  );
}
