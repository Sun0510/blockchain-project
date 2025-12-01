import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function MyPage({ userSub, userAddress }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [nfts, setNfts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [exchangeAmount, setExchangeAmount] = useState("");

  const navigate = useNavigate();

  // 사용자 데이터 조회
  useEffect(() => {
    async function fetchData() {
      try {
        const resUser = await API.get("/api/me");
        setUser(resUser.data);

        const resNFTs = await API.get("/api/nfts");
        const resTrades = await API.get("/api/trades");
        setTrades(resTrades.data.result);

        const myNFTs = resNFTs.data.result.filter(
          (nft) =>
            nft.onChainOwner?.toLowerCase() === resUser.data.wallet_address?.toLowerCase()
        );

        const myNFTsWithTrade = myNFTs.map((nft) => {
          const trade = resTrades.data.result.find(
            (t) =>
              t.tokenID.toString() === nft.tokenID.toString() &&
              t.address.toLowerCase() === nft.contractAddress.toLowerCase()
          );
          return { ...nft, trade };
        });

        setNfts(myNFTsWithTrade);
      } catch (err) {
        console.error(err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // 개인키 다운로드
  const downloadPrivateKey = async () => {
    try {
      setDownloading(true);
      const res = await API.get("/api/download-private-key", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "my_private_key.txt";
      link.click();
    } catch {
      alert("개인키 다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  // 토큰 → ETH 환전
  const handleExchange = async () => {
    if (!exchangeAmount || isNaN(exchangeAmount) || exchangeAmount <= 0) {
      alert("환전할 토큰 개수를 올바르게 입력해주세요.");
      return;
    }
    try {
      const res = await API.post("/api/exchange", {
        amount: parseFloat(exchangeAmount),
      });
      alert(`환전 완료! ${res.data.ethReceived} ETH를 받았습니다.`);
      const updatedUser = await API.get("/api/me");
      setUser(updatedUser.data);
    } catch (err) {
      alert("환전 실패: " + (err.response?.data?.error || err.message));
    }
  };

  if (loading)
    return <div className="text-white text-center py-40 text-2xl">Loading...</div>;
  if (!user)
    return <div className="text-white text-center py-40 text-2xl">로그인이 필요합니다</div>;

  return (
    <div className="py-32 px-6 text-white max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-10">My Page</h1>

      {/* 유저 정보 */}
      <div className="bg-gray-800/40 p-8 rounded-2xl border border-gray-700 mb-10 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4">User Info</h2>
        <p className="text-gray-300 mt-1">Email: {user.email}</p>
        <p className="text-gray-300 mt-1">Wallet: {user.wallet_address || "지갑 없음"}</p>

        {/* 버튼 박스 */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={downloadPrivateKey}
            disabled={downloading}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold shadow"
          >
            {downloading ? "다운로드 중..." : "개인키 TXT 다운로드"}
          </button>

          <button
            onClick={() => navigate("/mypage/edit")}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold shadow"
          >
            회원 정보 수정
          </button>
        </div>

        {/* 환전 */}
        <div className="mt-8 p-4 bg-gray-900/40 border border-gray-700 rounded-xl">
          <h3 className="font-semibold mb-3 text-lg">Token → ETH 환전</h3>

          <div className="flex items-center flex-wrap gap-3">
            <input
              type="number"
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(e.target.value)}
              placeholder="교환할 Token 개수"
              className="px-4 py-2 rounded-lg w-52 bg-white text-black font-semibold shadow"
            />
            <button
              onClick={handleExchange}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-semibold shadow"
            >
              환전하기
            </button>
          </div>
        </div>
      </div>

      {/* NFT 목록 */}
      <h2 className="text-2xl font-semibold mb-6">My NFTs</h2>
      {nfts.length === 0 ? (
        <p className="text-gray-300">소유한 NFT가 없습니다.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {nfts.map((nft) => {
            const isOwner =
              nft.onChainOwner?.toLowerCase() === user.wallet_address?.toLowerCase();
            const trade = nft.trade;

            return (
              <div
                key={nft.tokenID}
                className="bg-gray-800/40 rounded-xl border border-gray-700 p-4 shadow hover:border-indigo-500 hover:shadow-lg transition"
              >
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="rounded-lg mb-3 cursor-pointer"
                  onClick={() =>
                    navigate(`/nft/${nft.contractAddress}/${nft.tokenID}`)
                  }
                />
                <p className="text-lg font-semibold">{nft.name}</p>
                <p className="text-gray-300 text-sm mt-1">Token ID: {nft.tokenID}</p>

                <div className="mt-3 text-sm">
                  {isOwner ? (
                    !trade || trade.receiver !== null ? (
                      <p className="text-green-400 font-semibold mt-1">판매 등록 가능</p>
                    ) : (
                      <p className="text-yellow-400 font-semibold mt-1">
                        판매중 — {trade.price} ETH
                      </p>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
