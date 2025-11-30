import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";

export default function Reward() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rewardResult, setRewardResult] = useState(null);
  const [opening, setOpening] = useState(false);

  // 로그인 체크
  useEffect(() => {
    API.get("/api/me")
      .then(res => {
        console.log("User info:", res.data);
        setUser(res.data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const claimReward = async () => {
    if (opening || rewardResult) return; // 이미 지급 완료면 클릭 방지
    if (!user?.sub) {
      alert("사용자 정보가 없습니다. 다시 로그인해주세요.");
      return;
    }

    setOpening(true);

    try {
      const res = await API.post("/api/reward/open", { sub: user.id });
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
        <Link to="/login" className="bg-indigo-500 px-6 py-3 rounded-lg">
          Login
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full text-white bg-gray-900 px-6">
      <h1 className="text-4xl font-bold mb-10">🎁 토큰 보상 받기</h1>

      <button
        onClick={claimReward}
        disabled={opening || rewardResult} // 지급 완료 후 비활성화
        className={`w-60 h-60 bg-yellow-500 rounded-2xl text-black font-bold text-2xl cursor-pointer flex items-center justify-center transition-transform duration-300 ${
          opening ? "scale-110 rotate-3" : "hover:scale-105"
        } ${rewardResult ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {opening ? "Opening..." : rewardResult ? "지급 완료" : "CLICK"}
      </button>

      {rewardResult && (
        <div className="mt-10 text-center">
          <h2 className="text-3xl font-semibold mb-4">🎉 토큰 지급 완료!</h2>
          <p className="text-lg text-gray-200 mb-2">사용자 지갑 주소:</p>
          <p className="text-yellow-400 font-bold mb-4">{rewardResult.to}</p>
          <p className="text-lg text-gray-200 mb-2">토큰 컨트랙트 주소:</p>
          <p className="text-yellow-400 font-bold">{rewardResult.contractAddress}</p>
          <p className="text-lg text-gray-200 mt-4">
            TX Hash: <span className="text-indigo-300 break-all">{rewardResult.txHash}</span>
          </p>

          {/* GamePage로 돌아가기 버튼 */}
          <button
            onClick={() => navigate("/game")}
            className="mt-8 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-lg"
          >
            게임 화면으로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
