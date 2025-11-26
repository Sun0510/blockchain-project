import React, { useEffect, useState } from 'react';
import API from '../api';
import { Link } from 'react-router-dom';

export default function NFTList() {
  const sampleNFTs = [
    { id: 1, title: "Dreamscape", img: "https://picsum.photos/300?1" },
    { id: 2, title: "Cosmic Flow", img: "https://picsum.photos/300?2" },
    { id: 3, title: "Infinite Wave", img: "https://picsum.photos/300?3" },
  ];

  return (
    <div className="px-6 py-32 text-white">
      <h1 className="text-4xl font-bold mb-10">NFT Marketplace</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
        {sampleNFTs.map((nft) => (
          <Link
            key={nft.id}
            to={`/nfts/${nft.id}`}
            className="group rounded-2xl bg-gray-800/40 border border-gray-700 shadow-lg overflow-hidden hover:border-indigo-500 transition"
          >
            <img
              src={nft.img}
              className="w-full h-56 object-cover"
              alt={nft.title}
            />
            <div className="p-5">
              <h2 className="text-xl font-semibold group-hover:text-indigo-400 transition">
                {nft.title}
              </h2>
              <p className="text-gray-400 mt-1">Click to view details</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

