import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function NFTList() {
  const [nfts, setNfts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        const resNFTs = await axios.get("http://localhost:4000/api/nfts", { withCredentials: true });
        const resTrades = await axios.get("http://localhost:4000/api/trades", { withCredentials: true });

        const nftWithTrade = resNFTs.data.result.map(nft => {
          const trade = resTrades.data.result.find(
            t =>
              t.tokenID.toString() === nft.tokenID.toString() &&
              t.address.toLowerCase() === nft.contractAddress.toLowerCase()
          );
          return { ...nft, trade };
        });

        setNfts(nftWithTrade);
      } catch (err) {
        console.error("NFTList API ERROR:", err);
      }
    }
    fetchData();
  }, []);

  const handleClick = (nft) => {
    navigate(`/nft/${nft.contractAddress}/${nft.tokenID}`);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      <h2 style={{ marginBottom: 20, color: "white" }}>NFT Marketplace</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {nfts.map((item) => (
          <div
            key={`${item.contractAddress}-${item.tokenID}`}
            style={{
              width: 220,
              height: 350,                          
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: 10,
              backgroundColor: "#222",
              padding: 12,
              textAlign: "center",
              color: "white",
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
              cursor: "pointer",
            }}
            onClick={() => handleClick(item)}
          >
            <img
              src={item.image}
              alt={item.name}
              style={{
                width: "100%",
                height: 200,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />

            <div>
              <h3 style={{ marginTop: 10, fontSize: 18, fontWeight: "bold" }}>{item.name}</h3>

              <p style={{ fontSize: 14, margin: 4 }}>
                <b>Token ID:</b> {item.tokenID}
              </p>

              
              <div style={{ minHeight: 22 }}>
                {item.trade && (
                  <span
                    style={{
                      padding: "3px 6px",
                      backgroundColor: "#facc15",
                      color: "#000",
                      borderRadius: 6,
                      fontWeight: "bold",
                      fontSize: 13,
                    }}
                  >
                    판매중 — {item.trade.price} ETH
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
