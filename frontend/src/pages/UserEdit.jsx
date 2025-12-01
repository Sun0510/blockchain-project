import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function UserEdit() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);       
  const [loaded, setLoaded] = useState(false);  

  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");

  const [idAvailable, setIdAvailable] = useState(null); 

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get("http://localhost:4000/api/me", {
          withCredentials: true,
        });
        setUser(res.data);
      } catch (err) {
        console.error(err);
        setUser(undefined); 
      } finally {
        setLoaded(true);
      }
    };
    fetchUserInfo();
  }, []);

  const checkDuplicateId = async () => {
    if (!newId.trim()) {
      alert("ID를 입력해주세요.");
      return;
    }

    try {
      const res = await axios.post(
        "http://localhost:4000/users/check-id",
        { id: newId.trim() },
        { withCredentials: true }
      );

      setIdAvailable(res.data.available);
      if (res.data.available) alert("사용 가능한 ID입니다!");
      else alert("이미 사용 중인 ID입니다.");
    } catch (err) {
      console.error(err);
      alert("ID 확인 중 오류가 발생했습니다.");
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (newId.trim() && idAvailable !== true) {
      alert("ID 중복 확인을 완료해주세요.");
      return;
    }

    const updatedName = newName.trim() === "" ? user.name : newName.trim();
    const updatedId = newId.trim() === "" ? user.id : newId.trim();

    try {
      await axios.put(
        "http://localhost:4000/users/update",
        { name: updatedName, id: updatedId },
        { withCredentials: true }
      );

      alert("회원 정보가 수정되었습니다.");
      navigate("/mypage", { replace: true });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "정보 수정 중 오류가 발생했습니다.");
    }
  };

  if (!loaded) return <div className="text-white text-center py-40 text-2xl">로딩중...</div>;
  if (user === undefined) return <div className="text-white text-center py-40 text-2xl">로그인이 필요합니다.</div>;

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-gray-800/80 rounded-2xl shadow-lg text-white">
      <h2 className="text-3xl font-bold mb-6 text-center">회원 정보 수정</h2>

      <label className="block mb-2 font-semibold">이메일</label>
      <input 
        value={user.email} 
        disabled 
        className="w-full mb-4 p-3 rounded-lg bg-gray-700 text-gray-300 border border-gray-600 cursor-not-allowed"
      />

      <label className="block mb-2 font-semibold">이름</label>
      <input
        placeholder={user.name}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        className="w-full mb-4 p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      <label className="block mb-2 font-semibold">ID</label>
      <div className="flex gap-3 mb-2">
        <input
          placeholder={user.id}
          value={newId}
          onChange={(e) => {
            setNewId(e.target.value);
            setIdAvailable(null); 
          }}
          className="flex-1 p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={checkDuplicateId}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg font-semibold shadow transition"
        >
          중복 확인
        </button>
      </div>

      {idAvailable === true && <p className="text-green-400 mb-2">사용 가능한 ID ✔</p>}
      {idAvailable === false && <p className="text-red-400 mb-2">이미 사용 중인 ID ✖</p>}

      <button
        onClick={handleSave}
        className="w-full py-3 mt-4 bg-yellow-500 hover:bg-yellow-600 rounded-lg font-bold text-black shadow transition"
      >
        저장
      </button>
      <button
        onClick={() => navigate("/mypage")}
        className="w-full py-3 mt-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold text-white shadow transition"
      >
        취소
      </button>
    </div>
  );
}

export default UserEdit;
