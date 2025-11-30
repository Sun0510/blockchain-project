import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom"; // 추가

export default function NFTList() {
  const [nfts, setNfts] = useState([]);
  const navigate = useNavigate(); // 이동 함수

  useEffect(() => {
    axios
      .get("http://localhost:4000/api/nfts", { withCredentials: true })
      .then((res) => {
        console.log("NFT API Response:", res.data);
        setNfts(res.data.result);
      })
      .catch(err => console.error("NFT API ERROR:", err));
  }, []);

  const handleClick = (nft) => {
    // NFTDetail로 이동하면서 tokenID와 contractAddress를 query 또는 params로 전달
    navigate(`/nft/${nft.contractAddress}/${nft.tokenID}`);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: "white" }}>NFT Marketplace</h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        {nfts.map((item) => (
          <div
            key={`${item.contractAddress}-${item.tokenID}`}
            style={{
              width: 200,
              borderRadius: 10,
              backgroundColor: "#222",
              padding: 12,
              textAlign: "center",
              color: "white",
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              cursor: "pointer" 
            }}
            onClick={() => handleClick(item)}
          >
            <img
              src={item.image}
              alt={item.name}
              style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 8 }}
            />
            <h3 style={{ marginTop: 10, fontSize: 18, fontWeight: "bold" }}>{item.name}</h3>
            <p style={{ fontSize: 14, margin: 4 }}>
              <b>Token ID:</b> {item.tokenID}
            </p>
            <p style={{ fontSize: 14, margin: 4 }}>
              <b>소유자:</b> {item.ownerid ?? "미보유 (No Owner)"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
