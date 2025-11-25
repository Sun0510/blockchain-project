import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import SubmitPage from './pages/SubmitPage';
import NFTList from './pages/NFTList';
import NFTDetail from './pages/NFTDetail';
import MyPage from './pages/MyPage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* 헤더 */}
      <header className="bg-white shadow-md">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Web3 PoC</h1>
          <ul className="flex space-x-6 text-gray-700">
            <li><Link className="hover:text-blue-600 transition-colors" to="/">Home</Link></li>
            <li><Link className="hover:text-blue-600 transition-colors" to="/submit">Submit</Link></li>
            <li><Link className="hover:text-blue-600 transition-colors" to="/nfts">NFTs</Link></li>
            <li><Link className="hover:text-blue-600 transition-colors" to="/mypage">MyPage</Link></li>
            <li><Link className="hover:text-blue-600 transition-colors" to="/login">Login</Link></li>
          </ul>
        </nav>
      </header>

      {/* 랜딩 페이지 스타일 메인 */}
      <main className="max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center">
        {/* 좌측 텍스트 영역 */}
        <div className="lg:w-1/2 mb-12 lg:mb-0">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">
            코딩이 처음이라면, <span className="text-blue-600">Web3 PoC</span>
          </h2>
          <p className="text-gray-600 mb-6">
            11만 명이 넘는 비전공자, 코딩 입문자가 Web3 PoC를 선택했어요. <br />
            지금 함께 시작해보실래요?
          </p>
          <Link
            to="/submit"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded hover:bg-blue-700 transition-colors"
          >
            지금 시작하기
          </Link>
        </div>

        {/* 우측 이미지 영역 */}
        <div className="lg:w-1/2 flex justify-center">
          <img
            src="/mnt/data/2f47480e-3c9e-46e9-a9ec-4dc501e0a44e.png"
            alt="Web3 illustration"
            className="w-full max-w-md"
          />
        </div>
      </main>

      {/* 라우트 페이지 */}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/nfts" element={<NFTList />} />
        <Route path="/nfts/:id" element={<NFTDetail />} />
        <Route path="/mypage" element={<MyPage />} />
      </Routes>

      {/* 푸터 */}
      <footer className="bg-white border-t mt-20 py-6 text-center text-gray-500 text-sm">
        &copy; 2025 Web3 PoC. All rights reserved.
      </footer>
    </div>
  );
}
