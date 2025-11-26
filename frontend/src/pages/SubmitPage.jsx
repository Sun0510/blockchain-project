import React, { useState } from 'react';
import API from '../api';

export default function SubmitPage() {
  return (
    <div className="max-w-2xl mx-auto py-32 text-white">
      <h1 className="text-4xl font-bold mb-10">Submit Your NFT</h1>

      <form className="space-y-6 bg-gray-800/40 p-8 rounded-2xl shadow-xl border border-gray-700">
        <div>
          <label className="block text-gray-300 mb-1">Title</label>
          <input
            className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white p-3"
            placeholder="NFT Title"
          />
        </div>

        <div>
          <label className="block text-gray-300 mb-1">Description</label>
          <textarea
            rows="4"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 text-white p-3"
            placeholder="Describe your NFT..."
          ></textarea>
        </div>

        <div>
          <label className="block text-gray-300 mb-1">Upload Image</label>
          <input
            type="file"
            className="w-full text-gray-300"
          />
        </div>

        <button className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold py-3 rounded-lg">
          Submit NFT
        </button>
      </form>
    </div>
  );
}

