import React, { useEffect, useState } from 'react';
import API from '../api';

export default function MyPage() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    API.get('/me').then(res => setMe(res.data)).catch(console.error);
  }, []);

  if (!me) return <div>Loading...</div>;
  const { user, trade_requests, tokens_tx, nfts } = me;

  return (
    <div>
      <h3>My Page</h3>
      <div>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Name:</strong> {user.name}</p>
        <p><strong>Wallet:</strong> {user.wallet_address}</p>
        <p><strong>Encrypted Private Key Stored:</strong> {user.encrypted_private_key ? 'Yes' : 'No'}</p>
      </div>

      <h4>My NFTs</h4>
      <ul>{nfts.map(n => <li key={n.id}>{n.title} (for_sale: {String(n.for_sale)})</li>)}</ul>

      <h4>Trade Requests</h4>
      <pre>{JSON.stringify(trade_requests, null, 2)}</pre>

      <h4>Token Transactions</h4>
      <pre>{JSON.stringify(tokens_tx, null, 2)}</pre>
    </div>
  );
}
