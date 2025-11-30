import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function MyPage({ userSub, userAddress }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [nfts, setNfts] = useState([]);
  const [trades, setTrades] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const resUser = await API.get("/api/me");
        setUser(resUser.data);

        const resNFTs = await API.get("/api/nfts");
        const resTrades = await API.get("/api/trades");

        setTrades(resTrades.data.result);

        // 사용자가 소유한 NFT만 필터링
        const myNFTs = resNFTs.data.result.filter(
          (nft) =>
            nft.onChainOwner?.toLowerCase() === resUser.data.wallet_address?.toLowerCase()
        );

        // 각 NFT에 현재 거래(trade) 정보 붙이기
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
        <button
            onClick={() => navigate("/mypage/edit")}
            className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
          >
            회원 정보 수정
          </button>
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
                className="bg-gray-800/40 rounded-xl border border-gray-700 p-4 shadow hover:border-indigo-500 transition cursor-pointer"
              >
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="rounded-lg mb-3"
                  onClick={() =>
                    navigate(`/nft/${nft.contractAddress}/${nft.tokenID}`)
                  }
                />
                <p className="text-lg font-semibold">{nft.name}</p>
                <p className="text-gray-300 text-sm mt-1">Token ID: {nft.tokenID}</p>

                <div className="mt-2">
                  {isOwner ? (
                    !trade ? (
                      <p>판매 등록 가능</p>
                    ) : (
                      <>
                        <p>현재 가격: {trade.price} ETH</p>
                        <p>판매 상태: 판매중</p>
                      </>
                    )
                  ) : trade ? (
                    <>
                      <p>판매 가격: {trade.price} ETH</p>
                      <button className="mt-2 px-3 py-1 bg-indigo-600 rounded">구매하기</button>
                    </>
                  ) : (
                    <p>미판매중</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
