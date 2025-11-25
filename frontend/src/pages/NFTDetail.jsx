import React, { useEffect, useState } from 'react';
import API from '../api';
import { useParams } from 'react-router-dom';

export default function NFTDetail() {
  const { id } = useParams();
  const [nft, setNft] = useState(null);
  const [offer, setOffer] = useState('');

  useEffect(() => {
    API.get(`/nfts/${id}`).then(res => setNft(res.data.nft)).catch(console.error);
  }, [id]);

  async function sendOffer(e) {
    e.preventDefault();
    try {
      const res = await API.post(`/nfts/${id}/request-trade`, { offered_price: offer });
      alert('Offer submitted: ' + JSON.stringify(res.data.trade_request));
    } catch (err) {
      alert('Error: ' + (err.response?.data?.error || err.message));
    }
  }

  if (!nft) return <div>Loading...</div>;
  return (
    <div>
      <h3>{nft.title}</h3>
      <p>Owner: {nft.owner_name || 'None'}</p>
      <p>For sale: {nft.for_sale ? 'Yes' : 'No'}</p>
      <p>Price: {nft.listed_price || 'N/A'}</p>

      {nft.owner_name ? (
        <form onSubmit={sendOffer}>
          <div>
            <input value={offer} onChange={e=>setOffer(e.target.value)} placeholder="Offer price" />
            <button type="submit">Send Trade Request</button>
          </div>
        </form>
      ) : (
        <p>This NFT currently has no owner - cannot trade.</p>
      )}
    </div>
  );
}
