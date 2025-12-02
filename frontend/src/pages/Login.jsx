import React from 'react';
import API from '../api';

export default function Login() {
  const BACKEND_URL = import.meta.env.VITE_API_URL;
  const handleGoogleLogin = () => {
    // 백엔드 OAuth 로그인 URL로 이동
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };

  return (
    <div className="flex items-center justify-center py-32">
      <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 p-10 rounded-2xl shadow-2xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-white mb-10">
          Login
        </h2>

        {/* Google OAuth 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-red-500 hover:bg-red-400 text-white rounded-lg py-4 font-semibold transition flex items-center justify-center space-x-3"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-6 h-6"
          />
          <span>Sign in with Google</span>
        </button>
      </div>
    </div>
  );
}
