import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function UserEdit() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);        // 서버에서 가져온 유저 정보
  const [loaded, setLoaded] = useState(false);   // 로딩 완료 여부

  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");

  const [idAvailable, setIdAvailable] = useState(null); // null=확인전, true=사용가능, false=중복

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get("http://localhost:4000/api/me", {
          withCredentials: true,
        });
        setUser(res.data);
      } catch (err) {
        console.error(err);
        setUser(undefined); // 로그인 안됐을 경우
      } finally {
        setLoaded(true);
      }
    };
    fetchUserInfo();
  }, []);

  // 🔍 ID 중복 확인 버튼
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

  // 저장 버튼
  const handleSave = async () => {
    if (!user) return;

    // ID 입력했다면 중복 체크했는지 반드시 확인
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

  // ❗ 무한로딩 방지
  if (!loaded) return <div>로딩중...</div>;
  if (user === undefined) return <div>로그인이 필요합니다.</div>;

  return (
    <div style={{ maxWidth: "450px", margin: "auto" }}>
      <h2>회원 정보 수정</h2>

      <label>이메일</label>
      <input value={user.email} disabled style={{ width: "100%", marginBottom: "15px" }} />

      <label>이름</label>
      <input
        placeholder={user.name}
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        style={{ width: "100%", marginBottom: "20px" }}
      />

      <label>ID</label>
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          placeholder={user.id}
          value={newId}
          onChange={(e) => {
            setNewId(e.target.value);
            setIdAvailable(null); // ID 입력이 바뀌면 체크상태 초기화
          }}
          style={{ flex: 1 }}
        />
        <button onClick={checkDuplicateId}>중복 확인</button>
      </div>

      {idAvailable === true && <p style={{ color: "lightgreen" }}>사용 가능한 ID ✔</p>}
      {idAvailable === false && <p style={{ color: "red" }}>이미 사용 중인 ID ✖</p>}

      <button onClick={handleSave} style={{ width: "100%", padding: "10px", marginTop: "35px" }}>
        저장
      </button>
      <button
            onClick={() => navigate("/mypage")}
            className="px-5 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold"
          >
            취소
          </button>
    </div>
  );
}

export default UserEdit;
