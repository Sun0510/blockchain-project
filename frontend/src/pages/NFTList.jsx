import React, { useEffect, useState } from 'react';
import API from '../api';
import { Link } from 'react-router-dom';

export default function NFTList() {
  const [nfts, setNfts] = useState([]);

  useEffect(() => {
    API.get('/nfts').then(res => setNfts(res.data.nfts)).catch(console.error);
  }, []);

  return (
    <div>
      <h3>NFT List</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
        {nfts.map(n => (
          <div key={n.id} style={{ border: '1px solid #ddd', padding: 12 }}>
            <h4>{n.title}</h4>
            <p>Owner: {n.owner_name || 'None (not tradable)'}</p>
            <p>{n.for_sale ? `Price: ${n.listed_price}` : 'Not for sale'}</p>
            <Link to={`/nfts/${n.id}`}>Details</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
