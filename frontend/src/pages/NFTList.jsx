import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function NFTList() {
  const [nfts, setNfts] = useState([]);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_API_URL;
  useEffect(() => {
    async function fetchData() {
      try {
        try {
          const resUser = await axios.get(BACKEND_URL+"/api/me", {
            withCredentials: true,
          });
          setUser(resUser.data);
        } catch (e) {
          setUser(null);
        }

        // NFT 및 판매 정보 가져오기
        const resNFTs = await axios.get(BACKEND_URL+"/api/nfts", {
          withCredentials: true,
        });

        const resTrades = await axios.get(BACKEND_URL+"/api/trades", {
          withCredentials: true,
        });

        const nftWithTrade = resNFTs.data.result.map((nft) => {
          const trade = resTrades.data.result.find(
            (t) =>
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
        {nfts.map((item) => {
          const isOwner =
            user &&
            item.onChainOwner?.toLowerCase() ===
              user.wallet_address?.toLowerCase();
          const trade = item.trade;

          return (
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
                <h3 style={{ marginTop: 10, fontSize: 18, fontWeight: "bold" }}>
                  {item.name}
                </h3>

                <p style={{ fontSize: 14, margin: 4 }}>
                  <b>Token ID:</b> {item.tokenID}
                </p>

                {/* 판매 상태 표시 */}
                <div style={{ minHeight: 22 }}>
                  {isOwner ? (
                    !trade || trade.receiver !== null ? (
                      <p className="text-green-400 font-semibold mt-1">
                        판매 등록 가능
                      </p>
                    ) : (
                      <p className="text-yellow-400 font-semibold mt-1">
                        판매중 — {trade.price} ETH
                      </p>
                    )
                  ) : trade && trade.receiver === null ? (
                    <p className="text-yellow-400 font-semibold mt-1">
                      판매중 — {trade.price} ETH
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
