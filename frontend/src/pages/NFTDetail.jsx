import React, { useEffect, useState } from 'react';
import API from '../api';
import { useParams } from 'react-router-dom';

export default function NFTDetail() {
  const { id } = useParams();

  return (
    <div className="max-w-4xl mx-auto py-32 text-white">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <img
          src={`https://picsum.photos/600?random=${id}`}
          className="rounded-2xl shadow-2xl"
        />

        <div>
          <h1 className="text-4xl font-bold mb-4">NFT #{id}</h1>
          <p className="text-gray-300 mb-6">
            This is a detailed view of NFT #{id}.  
            You can replace this with real blockchain data.
          </p>

          <button className="bg-indigo-500 hover:bg-indigo-400 px-6 py-3 rounded-xl font-semibold transition">
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}

