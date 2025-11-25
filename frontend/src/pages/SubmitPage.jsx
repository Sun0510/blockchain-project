import React, { useState } from 'react';
import API from '../api';

export default function SubmitPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await API.post('/submit', { input });
      setResult(res.data);
    } catch (err) {
      setResult({ ok: false, error: err.response?.data?.error || err.message });
    }
  }

  return (
    <div>
      <h3>Submit Input</h3>
      <form onSubmit={submit}>
        <div>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Type something..." />
          <button type="submit" style={{ marginLeft: 8 }}>Submit</button>
        </div>
      </form>

      {result && (
        <div style={{ marginTop: 12 }}>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
