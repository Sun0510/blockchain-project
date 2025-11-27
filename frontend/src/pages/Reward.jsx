import React, { useEffect, useState } from "react";
import API from "../api";

export default function Reward() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rewardResult, setRewardResult] = useState(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    API.get("/api/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const claimReward = () => {
    if (opening) return;
    setOpening(true);

    API.post("/api/reward/open") // NFT 지급 API 호출
      .then((res) => {
        setRewardResult(res.data);
      })
      .catch(() => alert("리워드 지급 실패"))
      .finally(() => setOpening(false));
  };

  if (loading)
    return <div className="text-white text-center py-40 text-2xl">Loading...</div>;
  if (!user)
    return <div className="text-white text-center py-40 text-2xl">로그인이 필요합니다</div>;

  return (
    <div className="flex flex-col items-center justify-center py-32 text-white">
      <h1 className="text-4xl font-bold mb-10">🎁 보상 상자 오픈</h1>

      {/* 중앙 상자 */}
      <div
        onClick={claimReward}
        className={`w-60 h-60 bg-yellow-500 rounded-2xl flex items-center justify-center text-black font-bold text-2xl cursor-pointer transition transform ${
          opening ? "scale-110 rotate-3" : "hover:scale-105"
        }`}
      >
        {opening ? "Opening..." : "CLICK"}
      </div>

      {/* 결과 표시 */}
      {rewardResult && (
        <div className="mt-10 text-center">
          <h2 className="text-3xl font-semibold mb-4">🎉 NFT 획득!</h2>
          <img
            src={`https://picsum.photos/400?reward=${rewardResult.address}`}
            className="rounded-xl mb-4 mx-auto"
          />
          <p className="text-xl text-gray-200">NFT Address:</p>
          <p className="text-yellow-400 text-lg font-bold">{rewardResult.address}</p>
        </div>
      )}
    </div>
  );
}
