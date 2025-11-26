import { useState } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { Link, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import SubmitPage from "./pages/SubmitPage";
import NFTList from "./pages/NFTList";
import NFTDetail from "./pages/NFTDetail";
import MyPage from "./pages/MyPage";

const navigation = [
  { name: "Submit", href: "/submit" },
  { name: "NFTs", href: "/nfts" },
  { name: "My Page", href: "/mypage" },
];

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* HEADER */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav
          className="flex items-center justify-between p-6 lg:px-8"
          aria-label="Global"
        >
          <div className="flex lg:flex-1">
            <Link to="/" className="-m-1.5 p-1.5">
              <img
                alt="logo"
                src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
                className="h-8 w-auto"
              />
            </Link>
          </div>

          {/* mobile menu button */}
          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-200"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Bars3Icon className="size-6" aria-hidden="true" />
            </button>
          </div>

          {/* pc navigation */}
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="text-sm font-semibold text-white"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* login button */}
          <div className="hidden lg:flex lg:flex-1 lg:justify-end">
            <Link
              to="/login"
              className="text-sm font-semibold text-white hover:text-indigo-300"
            >
              Login →
            </Link>
          </div>
        </nav>

        {/* MOBILE MENU */}
        <Dialog
          open={mobileMenuOpen}
          onClose={setMobileMenuOpen}
          className="lg:hidden"
        >
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
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 p-2.5 rounded-md text-gray-200"
              >
                <XMarkIcon className="size-6" aria-hidden="true" />
              </button>
            </div>

            {/* mobile menu content */}
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

              <Link
                to="/login"
                className="block rounded-lg px-3 py-2 text-base font-semibold text-white hover:bg-white/5"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
            </div>
          </DialogPanel>
        </Dialog>
      </header>

      {/* PAGE CONTENT */}
      <main className="pt-24 px-6">
        <Routes>
          <Route
            path="/"
            element={
              <div className="text-center text-white py-32">
                <h1 className="text-5xl font-bold">HashSh</h1>
                <p className="mt-4 text-gray-400">
                  Uncrypt, get tokens and have NFTs!
                </p>
              </div>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/nfts" element={<NFTList />} />
          <Route path="/nfts/:id" element={<NFTDetail />} />
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </main>
    </div>
  );
}
