import React, { useState } from 'react';
import API from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function signup(e) {
    e.preventDefault();
    try {
      const res = await API.post('/auth/signup', { email, password, name: '' });
      localStorage.setItem('poc_token', res.data.token);
      alert('Signed up and logged in');
    } catch (e) {
      alert('Signup error: ' + (e.response?.data?.error || e.message));
    }
  }

  async function login(e) {
    e.preventDefault();
    try {
      const res = await API.post('/auth/login', { email, password });
      localStorage.setItem('poc_token', res.data.token);
      alert('Logged in');
    } catch (e) {
      alert('Login error: ' + (e.response?.data?.error || e.message));
    }
  }

  return (
    <div>
      <h3>Login / Signup (Email)</h3>
      <form onSubmit={(e)=>e.preventDefault()}>
        <div>
          <label>Email: </label>
          <input value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label>Password: </label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" />
        </div>
        <button onClick={login}>Login</button>
        <button onClick={signup} style={{ marginLeft: 8 }}>Signup</button>
      </form>

      <hr />
      <p>Google OAuth button (stub):</p>
      <button onClick={()=>alert('In PoC Google OAuth is a stub — set up OAuth in backend and redirect')}>Sign in with Google (stub)</button>
    </div>
  );
}
