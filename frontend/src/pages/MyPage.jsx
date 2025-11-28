import React, { useEffect, useState } from "react";
import API from "../api";

export default function MyPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    API.get("/api/me")
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const downloadPrivateKey = async () => {
    try {
      setDownloading(true);
      const res = await API.get("/api/download-private-key", {
        responseType: "blob", // 파일 다운로드 중요!
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "my_private_key.txt";
      link.click();
    } catch (error) {
      alert("개인키 다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <div className="text-white text-center py-40 text-2xl">Loading...</div>;
  if (!user) return <div className="text-white text-center py-40 text-2xl">로그인이 필요합니다</div>;

  return (
    <div className="py-32 px-6 text-white max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-10">My Page</h1>

      {/* 유저 정보 */}
      <div className="bg-gray-800/40 p-8 rounded-2xl border border-gray-700 mb-10">
        <h2 className="text-2xl font-semibold">User Info</h2>
        <p className="text-gray-300 mt-2">Email: {user.email}</p>
        <p className="text-gray-300 mt-1">
          Wallet: {user.wallet_address || "지갑 없음"}
        </p>

        <button
          onClick={downloadPrivateKey}
          disabled={downloading}
          className="mt-5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold"
        >
          {downloading ? "다운로드 중..." : "개인키 TXT 다운로드"}
        </button>
      </div>

      {/* NFT 목록 */}
      <h2 className="text-2xl font-semibold mb-6">My NFTs</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3].map((id) => (
          <div key={id} className="bg-gray-800/40 rounded-xl border border-gray-700 p-4 shadow hover:border-indigo-500 transition">
            <img src={`https://picsum.photos/300?my=${id}`} className="rounded-lg mb-3" />
            <p className="text-lg font-semibold">My NFT #{id}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
