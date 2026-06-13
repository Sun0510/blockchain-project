import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";

import closedBox from "../assets/closed_box.png";
import openBox from "../assets/opened_box.png";

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Reward() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rewardResult, setRewardResult] = useState(null);
  const [opening, setOpening] = useState(false);

  // 로그인 체크
  useEffect(() => {
    API.get(BACKEND_URL+"/api/me")
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // 뒤로가기 완전 비활성화
  useEffect(() => {
    const handlePopState = () => {
      // 이전 페이지로 이동 시 무시하고 현재 페이지 유지
      window.history.pushState(null, "", window.location.href);
    };

    // 현재 페이지를 히스토리에 추가
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const claimReward = async () => {
    if (opening || rewardResult) return;
    if (!user) {
      alert("사용자 정보가 없습니다. 다시 로그인해주세요.");
      return;
    }

    setOpening(true);

    try {
      const res = await API.post(BACKEND_URL+"/api/reward/open", {});
      setRewardResult(res.data);
    } catch (e) {
      console.error(e);
      alert("리워드 지급 실패");
    } finally {
      setOpening(false);
    }
  };

  if (loading)
    return <div className="text-white text-center py-40 text-2xl">Loading...</div>;

  if (!user)
    return (
      <div className="text-center text-white py-40 space-y-6">
        <p className="text-2xl">로그인이 필요합니다</p>
        <Link
          to="/login"
          className="bg-indigo-500 hover:bg-indigo-600 px-6 py-3 rounded-lg font-semibold shadow"
        >
          Login
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full text-white bg-gray-900 px-6">
      <h1 className="text-4xl font-bold mb-12">🎁 토큰 보상 받기</h1>

      {/* 중앙 보상 버튼 (이미지) */}
      <button
        onClick={claimReward}
        disabled={opening || rewardResult}
        className={`w-64 h-64 relative transition-transform duration-300
          ${opening ? "scale-105 animate-pulse" : "hover:scale-110"}
          ${rewardResult ? "opacity-80 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <img
          src={rewardResult ? openBox : closedBox}
          alt={rewardResult ? "열린 상자" : "보물 상자"}
          className="w-full h-full object-contain"
        />
        {!rewardResult && opening && (
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-black">
            Opening...
          </span>
        )}
      </button>

      {/* 지급 완료 후 정보 표시 */}
      {rewardResult && (
        <div className="mt-12 bg-gray-800/70 p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <h2 className="text-3xl font-semibold mb-6 text-green-400">🎉 토큰 지급 완료!</h2>

          <div className="text-gray-300 space-y-2 mb-4">
            <p>사용자 지갑 주소:</p>
            <p className="text-yellow-400 font-bold break-all">{rewardResult.to}</p>

            <p>토큰 컨트랙트 주소:</p>
            <p className="text-yellow-400 font-bold break-all">{rewardResult.contractAddress}</p>

          </div>

          <button
            onClick={() => navigate("/game")}
            className="mt-6 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transition"
          >
            게임 화면으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
