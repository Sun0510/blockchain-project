import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

export default function NFTDetail({ userSub, userAddress }) {
  const { contractAddress, tokenID } = useParams();
  const [nft, setNft] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inputPrice, setInputPrice] = useState("");

  // NFT 데이터 가져오기
  useEffect(() => {
    async function fetchNFT() {
      try {
        const res = await axios.get(`http://localhost:4000/api/nfts`, { withCredentials: true });
        const nftList = res.data.result;
        const nftData = nftList.find(
          (item) =>
            item.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
            item.tokenID.toString() === tokenID.toString()
        );
        if (!nftData) setError("NFT를 찾을 수 없습니다.");
        else setNft(nftData);
      } catch (err) {
        console.error(err);
        setError("NFT 데이터를 가져오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }
    fetchNFT();
  }, [contractAddress, tokenID]);

  // NFT 거래 정보 가져오기
  useEffect(() => {
    async function fetchTrades() {
      if (!nft) return;
      try {
        const res = await axios.get(
          `http://localhost:4000/api/trades/${nft.contractAddress}/${nft.tokenID}`,
          { withCredentials: true }
        );
        if (res.data.success) setTrades(res.data.trades);
      } catch (err) {
        console.error("Failed to fetch trades:", err);
      }
    }
    fetchTrades();
  }, [nft]);

  const isOwner = nft?.onChainOwner?.toLowerCase() === userAddress?.toLowerCase();
  const currentTrade = trades[0]; // 판매 중인 거래가 있으면 첫 번째
  const isForSale = !!currentTrade;

  const handleAction = async (action) => {
    if (!userSub) return alert("로그인 필요");

    try {
      const payload = {
        tokenID: nft.tokenID,
        contractAddress: nft.contractAddress,
        price: parseFloat(inputPrice),
        userSub,
        seq: currentTrade?.seq // 현재 거래 seq
      };
      const res = await axios.post(
        `http://localhost:4000/api/trades/${action}`,
        payload,
        { withCredentials: true }
      );
      alert(res.data.message);

      // 거래 정보 갱신
      const tradeRes = await axios.get(
        `http://localhost:4000/api/trades/${nft.contractAddress}/${nft.tokenID}`,
        { withCredentials: true }
      );
      if (tradeRes.data.success) setTrades(tradeRes.data.trades);

    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "오류 발생");
    }
  };

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!nft) return <p style={{ color: "white" }}>NFT 데이터가 없습니다.</p>;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20, color: "white" }}>
      <h2 style={{ marginBottom: 20, fontSize: 28 }}>{nft.name}</h2>
      <img
        src={nft.image}
        alt={nft.name}
        style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 10 }}
      />
      <div style={{ marginTop: 20, fontSize: 16 }}>
        <p><b>Token ID:</b> {nft.tokenID}</p>
        <p><b>Contract Address:</b> {nft.contractAddress}</p>
        <p><b>Owner:</b> {nft.ownerId ?? "미보유"}</p>
      </div>

      <div style={{ marginTop: 20 }}>
        {isOwner ? (
          !isForSale ? (
            <>
              <input
                type="number"
                placeholder="가격 입력"
                value={inputPrice}
                onChange={e => setInputPrice(e.target.value)}
              />
              <button onClick={() => handleAction("sell")}>NFT 판매하기</button>
            </>
          ) : (
            <>
              <p>현재 가격: {currentTrade.price ?? "-"} sepoliaETH</p>
              <input
                type="number"
                value={inputPrice}
                onChange={e => setInputPrice(e.target.value)}
              />
              <button onClick={() => handleAction("updatePrice")}>가격 수정</button>
              <button onClick={() => handleAction("cancel")}>거래 취소</button>
            </>
          )
        ) : !isForSale ? (
          <p>미판매중</p>
        ) : (
          <>
            <p>판매 가격: {currentTrade.price ?? "-"} ETH</p>
            <button onClick={() => handleAction("buy")}>구매하기</button>
          </>
        )}
      </div>
    </div>
  );
}
