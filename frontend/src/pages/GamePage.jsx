import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";

export default function GamePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const [rewardHistory, setRewardHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    API.get("/api/me")
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    API.get("/api/reward/history")
      .then(res => setRewardHistory(res.data))
      .catch(() => setRewardHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [user]);

  const submit = async () => {
    if (!input || input.length > 20) {
      alert("20자 이하의 문자열만 입력 가능");
      return;
    }

    try {
      if (!user?.sub) {
        alert("사용자 정보(sub)가 없습니다. 다시 로그인해주세요.");
        return;
      }

      const res = await API.post("/api/game/submit", { input, sub: user.sub });
      setResult(res.data);

      if (res.data.success && !res.data.duplicate) {
        navigate("/reward");
      } else if (res.data.duplicate) {
        alert("이미 제출된 값입니다. 다른 문자열을 입력해주세요.");
      } else {
        alert("실패 ❌ 범위 밖입니다. 다시 입력해주세요.");
      }
    } catch {
      alert("서버 오류");
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
    <div className="flex flex-col lg:flex-row text-white min-h-screen">
      {/* ⬅ LEFT: Game 화면 */}
      <div className="flex-1 max-w-xl mx-auto py-16 px-6 lg:py-32">
        <h1 className="text-4xl font-bold mb-8">Game</h1>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          maxLength={20}
          placeholder="최대 20자 입력"
          className="w-full p-3 rounded-xl bg-gray-900 border border-gray-700 mb-4 text-white shadow focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={submit}
          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-xl shadow transition-all"
        >
          제출하기
        </button>

        {result && (
          <div className="mt-6 bg-gray-800/70 rounded-2xl p-5 text-sm space-y-2 border border-gray-700 shadow">
            <p><span className="font-semibold">해시 값:</span> {result.answer}</p>
            <p><span className="font-semibold">랜덤 범위:</span> {result.low} ~ {result.high}</p>
            <p>
              <span className="font-semibold">결과:</span>{" "}
              <span className={result.success ? "text-green-400" : "text-red-400"}>
                {result.success ? "성공 🎉" : "실패 ❌"}
              </span>
            </p>
            {result.duplicate && <p className="text-yellow-400">이미 등록된 값입니다.</p>}
          </div>
        )}
      </div>

      {/* ➡ RIGHT: Reward 내역 패널 */}
      <aside className="w-full lg:w-80 bg-gray-900/60 border-l border-gray-700 p-6 overflow-y-auto lg:overflow-y-auto">
        <h2 className="text-2xl font-semibold mb-6">Reward History</h2>

        {historyLoading && <p className="text-gray-400 text-sm">불러오는 중...</p>}

        {!historyLoading && rewardHistory.length === 0 && (
          <p className="text-gray-400 text-sm">아직 지급된 NFT가 없습니다.</p>
        )}

        {[...rewardHistory]
          .sort(
            (a, b) =>
              new Date(b.answered_at.replace(" ", "T")) -
              new Date(a.answered_at.replace(" ", "T"))
          )
          .map(item => (
            <div
              key={item.answered_at}
              className="mb-6 bg-gray-800/50 p-4 rounded-2xl border border-gray-700 shadow hover:shadow-lg transition"
            >
              <p className="text-lg font-semibold text-yellow-400 break-all">
                제출 문자열: {item.str}
              </p>
              <p className="text-indigo-300 text-sm mt-1">제출한 사람 ID: {item.userId}</p>
              <p className="text-gray-400 text-xs mt-2">
                {new Date(item.answered_at.replace(" ", "T")).toLocaleString("ko-KR")}
              </p>
            </div>
          ))}
      </aside>
    </div>
  );
}
