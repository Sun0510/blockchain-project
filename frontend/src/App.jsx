import { useState, useEffect } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, Routes, Route, useNavigate } from "react-router-dom";
import API from "./api";

import Login from "./pages/Login";
import GamePage from "./pages/GamePage";
import NFTList from "./pages/NFTList";
import NFTDetail from "./pages/NFTDetail";
import MyPage from "./pages/MyPage";
import UserEdit from "./pages/UserEdit";
import Reward from "./pages/Reward";

const navigation = [
  { name: "Game", href: "/game" },
  { name: "NFTs", href: "/nfts" },
  { name: "My Page", href: "/mypage" },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [ethBalance, setEthBalance] = useState("-");
  const [tokenBalance, setTokenBalance] = useState("-");
  const navigate = useNavigate();

  // 로그인 상태 확인
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await API.get("/api/me");
        setUser(res.data);
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  // 잔액 조회
  useEffect(() => {
    const fetchBalances = async () => {
      if (!user) return;
      try {
        const res = await API.get("/api/balances");
        setEthBalance(res.data.ethBalance);
        setTokenBalance(res.data.tokenBalance);
      } catch {
        setEthBalance("N/A");
        setTokenBalance("N/A");
      }
    };
    fetchBalances();
  }, [user]);

  // 로그아웃
  const handleLogout = () => {
    API.post("/api/logout").finally(() => {
      setUser(null);
      navigate("/");
    });
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <Link to="/" className="-m-1.5 p-1.5">
              <img
                alt="logo"
                src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* PC 메뉴 */}
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <Link key={item.name} to={item.href} className="text-sm font-semibold text-white">
                {item.name}
              </Link>
            ))}
          </div>

          {/* 잔액 / 로그인 */}
          <div className="hidden lg:flex lg:flex-1 lg:justify-end items-center space-x-6">
            {user && (
              <>
                <span className="text-white font-semibold">ID: {user.id}</span>
                <span className="text-gray-200">sepoliaETH: {ethBalance}</span>
                <span className="text-yellow-400 font-bold">SHINU: {tokenBalance}</span>
              </>
            )}
            {user ? (
              <button onClick={handleLogout} className="text-sm font-semibold text-white hover:text-red-300">
                Logout →
              </button>
            ) : (
              <Link to="/login" className="text-sm font-semibold text-white hover:text-indigo-300">
                Login →
              </Link>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-200"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </nav>

        {/* MOBILE MENU */}
        <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
          <div className="fixed inset-0 z-50" />
          <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-sm bg-gray-900 p-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <Link to="/" className="-m-1.5 p-1.5">
                <img
                  alt=""
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
                  className="h-8 w-auto"
                />
              </Link>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="-m-2.5 p-2.5 rounded-md text-gray-200">
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="block rounded-lg px-3 py-2 text-base font-semibold text-white hover:bg-white/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              {user ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="block rounded-lg px-3 py-2 text-base font-semibold text-white hover:bg-white/5"
                >
                  Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  className="block rounded-lg px-3 py-2 text-base font-semibold text-white hover:bg-white/5"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login
                </Link>
              )}
            </div>
          </DialogPanel>
        </Dialog>
      </header>

      {/* PAGE CONTENT */}
      <main className="pt-24 px-6">
        <Routes>
          {/* 메인 페이지 */}
          <Route
            path="/"
            element={
              <div className="relative isolate overflow-hidden py-32">

                {/* 배경 효과 → pointer-events-none 추가 */}
                <div
                  className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent opacity-70"
                  aria-hidden="true"
                />

                <div className="mx-auto max-w-4xl text-center">
                  <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl drop-shadow-lg">
                    HashSh Web3 Universe
                  </h1>

                  <p className="mt-6 text-lg leading-8 text-gray-300 max-w-2xl mx-auto">
                    🎮 게임을 플레이하고 보상을 획득하고, <br />
                    토큰과 NFT를 소유하며 블록체인 경험을 즐겨보세요!
                  </p>

                  <div className="mt-10 flex items-center justify-center gap-6">
                    <Link
                      to="/game"
                      className="rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      게임 시작하기 →
                    </Link>
                    <Link
                      to="/nfts"
                      className="text-lg font-semibold text-gray-200 hover:text-white hover:underline"
                    >
                      NFT 둘러보기
                    </Link>
                  </div>
                </div>

                {/* 빛 효과 → pointer-events-none 추가 */}
                <div
                  className="absolute -top-12 left-1/2 -translate-x-1/2 w-[650px] h-[650px] rounded-full pointer-events-none bg-purple-500/10 blur-3xl"
                  aria-hidden="true"
                />
              </div>
            }
          />

          <Route path="/login" element={<Login />} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/nfts" element={<NFTList />} />
          <Route path="/nfts/:id" element={<NFTDetail />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/mypage/edit" element={<UserEdit />} />
          <Route path="/reward" element={<Reward />} />
          <Route
            path="/nft/:contractAddress/:tokenID"
            element={<NFTDetail userSub={user?.sub} userAddress={user?.wallet_address} />}
          />
        </Routes>
      </main>
    </div>
  );
}
